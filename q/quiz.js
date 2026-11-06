// Likewise quiz landing pages: the shared engine behind every page under /q/.
// Questions, answers and stats live in questions.js, so wording changes never need this file.
// The signup half mirrors index.html (same Supabase edge function, Turnstile key, Mailchimp
// list, GA4/Meta/Reddit events and vote + suggestion modals) so a quiz signup is identical
// to a homepage signup.

// ── Config (same values as index.html) ───────────────────────────────
const SUPABASE_URL = 'https://lzruzawxicemxoapsvkk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BjODn9YikMaJ4nxYbcWZYA_dXg8oG7z';
const TURNSTILE_SITEKEY = '0x4AAAAAAEX7F-FOoX8LFTfc';
const MAILCHIMP_ACTION = 'https://joinlikewise.us7.list-manage.com/subscribe/post?u=7b458c7dca6cbe9e9f56b8133&id=058aea9e0f&f_id=00a7bde4f0';
const MAILCHIMP_HONEYPOT = 'b_7b458c7dca6cbe9e9f56b8133_058aea9e0f';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const quizKey = document.body.dataset.quiz;
const quiz = (window.LIKEWISE_QUIZZES || {})[quizKey];
const root = document.getElementById('quiz');
const pageParams = new URLSearchParams(window.location.search);

const state = {
  step: 0,
  answers: [],
  started: false,
  locked: false,
  responseId: null,
  savePromise: null,
};
let currentSubscriberEmail = sessionStorage.getItem('likewiseSubscriberEmail');

// supabase-js loads async after this file so the first question paints without waiting on it;
// by the time anyone reaches the result screen it's long since arrived.
let supabaseClient = null;
function db() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// Google Analytics event, tagged with which quiz page it came from. GA4 event names
// can't contain spaces, so these are quiz_started, quiz_answered and quiz_signup.
function track(event, params) {
  window.gtag?.('event', event, Object.assign({ quiz: quizKey }, params));
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The response id is made here, not by Supabase, so the page can link it to a signup later
// without anonymous visitors ever being allowed to read the table back.
function makeUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Page shell ───────────────────────────────────────────────────────
function renderShell() {
  const segments = quiz.questions.length + 1; // one per question, plus the result
  root.innerHTML = `
    <header class="quiz-top">
      <a class="quiz-logo" href="/${esc(window.location.search)}"><img src="/likewise-logo-2row-terracotta.png" alt="Likewise"></a>
      <div class="quiz-progress" aria-hidden="true">${'<span></span>'.repeat(segments)}</div>
    </header>
    <section class="quiz-screen" id="quizScreen"></section>
    <footer class="quiz-footer">
      <a href="mailto:hello@joinlikewise.ca">hello@joinlikewise.ca</a>
      <a href="/privacy.html">Privacy</a>
    </footer>
  `;
  document.body.insertAdjacentHTML('beforeend', MODALS_HTML + '<iframe name="mc-hidden-iframe" style="display:none;" title="signup" aria-hidden="true"></iframe>');
}

function screenEl() { return document.getElementById('quizScreen'); }

function showScreen(html) {
  const screen = screenEl();
  screen.classList.remove('enter');
  screen.innerHTML = html;
  void screen.offsetWidth; // restart the fade-in animation
  screen.classList.add('enter');
  document.querySelectorAll('.quiz-progress span').forEach((s, i) => s.classList.toggle('done', i <= state.step));
  window.scrollTo(0, 0);
}

// ── Questions ────────────────────────────────────────────────────────
function showQuestion(i) {
  state.step = i;
  const q = quiz.questions[i];
  const total = quiz.questions.length;
  showScreen(`
    <p class="quiz-kicker">${esc(quiz.kicker)} &middot; ${i + 1} of ${total}</p>
    <h1 class="quiz-question" tabindex="-1">${esc(q.text)}</h1>
    <div class="quiz-answers">
      ${q.answers.map((a, j) => `<button type="button" class="quiz-answer" data-answer="${j}">${esc(a)}</button>`).join('')}
    </div>
    ${i > 0
      ? '<button type="button" class="quiz-back">&larr; Back</button>'
      : '<p class="quiz-hint">Tap an answer. Anonymous, takes 10 seconds.</p>'}
  `);
}

function chooseAnswer(btn) {
  if (state.locked) return;
  state.locked = true;
  btn.classList.add('selected');

  const i = state.step;
  const q = quiz.questions[i];
  state.answers[i] = { question_id: q.id, question: q.text, answer: q.answers[Number(btn.dataset.answer)] };

  if (!state.started) {
    state.started = true;
    track('quiz_started');
  }

  // A short beat so the tap visibly registers before the next screen slides in.
  setTimeout(() => {
    state.locked = false;
    if (i + 1 < quiz.questions.length) showQuestion(i + 1);
    else showResult();
  }, 180);
}

// ── Result + signup ──────────────────────────────────────────────────
function showResult() {
  state.step = quiz.questions.length;
  const result = quiz.result;
  const yours = state.answers[(result.compareTo || 1) - 1].answer;
  const isPlaceholder = /^\s*\[STAT NEEDED/i.test(result.stat);
  if (isPlaceholder) console.warn('Likewise quiz: stat still needs filling in for', quizKey);

  showScreen(`
    <p class="quiz-kicker">How you compare</p>
    <div class="quiz-result">
      <p class="quiz-stat${isPlaceholder ? ' is-placeholder' : ''}">${esc(result.stat)}</p>
      ${result.source && !isPlaceholder ? `<p class="quiz-source">Source: ${esc(result.source)}</p>` : ''}
      <p class="quiz-you">You said <strong>${esc(yours)}</strong></p>
    </div>

    <div class="quiz-signup">
      <h2 class="quiz-signup-title">Join the waitlist to see how you compare to <em>people like you.</em></h2>
      <form class="quiz-form" id="quizForm" novalidate>
        <div class="email-field" id="quizEmailField">
          <svg class="email-field-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
            <path d="M4 6.5L12 13l8-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input type="email" class="email-input" id="quizEmail" placeholder="Enter your email" autocomplete="email" inputmode="email" aria-label="Email address">
        </div>
        <div class="quiz-turnstile" id="quizTurnstile"></div>
        <p class="turnstile-error" id="quizTurnstileError">Please complete the verification check above.</p>
        <button type="submit" class="submit-btn" id="quizSubmit">Join waitlist</button>
      </form>
      <div class="success-msg" id="quizSuccess">
        <span class="success-text"><strong>You're on the list.</strong> We'll reach out before launch with your founding member access.</span>
      </div>
      <p class="form-perk">Help pick our first question, plus tell us what else you want to know.</p>
      <p class="form-note">Free to start. No credit card required.</p>
    </div>
  `);

  const answerProps = {};
  state.answers.forEach(a => { answerProps[a.question_id] = a.answer; });
  track('quiz_answered', answerProps);

  saveResponse();
  renderTurnstile();
}

// Anonymous save: quiz name, answers and the ad's UTM tags. Nothing personal.
function saveResponse() {
  if (state.savePromise) return;
  state.responseId = makeUuid();
  const row = { id: state.responseId, quiz: quizKey, answers: state.answers };
  UTM_KEYS.forEach(k => { if (pageParams.get(k)) row[k] = pageParams.get(k).slice(0, 200); });

  state.savePromise = (async () => {
    try {
      const client = db();
      if (!client) throw new Error('Supabase library not loaded');
      const { error } = await client.from('quiz_responses').insert(row);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Quiz answer save error:', err);
      return false;
    }
  })();
}

// ── Turnstile (bot check) ────────────────────────────────────────────
// Rendered on demand rather than on page load: tokens expire after five minutes, and the
// widget only exists once the result screen does. "interaction-only" keeps it invisible
// unless Cloudflare actually needs the visitor to tick a box.
let turnstileToken = null;
let turnstileWaiters = [];
let turnstileWanted = false;
let turnstileFailed = false;

window.onQuizTurnstileLoad = function () {
  if (turnstileWanted) renderTurnstile();
};

function renderTurnstile() {
  turnstileWanted = true;
  const el = document.getElementById('quizTurnstile');
  if (!el || !window.turnstile || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  window.turnstile.render(el, {
    sitekey: TURNSTILE_SITEKEY,
    size: 'flexible',
    appearance: 'interaction-only',
    callback(token) {
      turnstileToken = token;
      document.getElementById('quizTurnstileError')?.classList.remove('show');
      turnstileWaiters.forEach(resolve => resolve());
      turnstileWaiters = [];
    },
    'expired-callback'() { turnstileToken = null; },
    'error-callback'() {
      turnstileToken = null;
      turnstileFailed = true;
      turnstileWaiters.forEach(resolve => resolve());
      turnstileWaiters = [];
      return true; // handled: stops Turnstile re-throwing into the console
    },
  });
}

function waitForTurnstile(ms) {
  if (turnstileToken || turnstileFailed) return Promise.resolve();
  return new Promise(resolve => {
    turnstileWaiters.push(resolve);
    setTimeout(resolve, ms);
  });
}

// ── Waitlist form ────────────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const input = document.getElementById('quizEmail');
  const field = document.getElementById('quizEmailField');
  const submit = document.getElementById('quizSubmit');
  const email = input.value.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!re.test(email)) {
    field.classList.add('invalid');
    input.focus();
    setTimeout(() => field.classList.remove('invalid'), 2000);
    return;
  }
  if (submit.disabled) return;

  if (!turnstileToken) {
    // The invisible check usually finishes within a second or two of the result screen.
    submit.disabled = true;
    submit.textContent = 'One sec…';
    await waitForTurnstile(8000);
    submit.disabled = false;
    submit.textContent = 'Join waitlist';
  }
  if (!turnstileToken) {
    const errorEl = document.getElementById('quizTurnstileError');
    errorEl.textContent = turnstileFailed
      ? "We couldn't verify you're human. Please refresh the page and try again."
      : 'Please complete the verification check above.';
    errorEl.classList.add('show');
    return;
  }

  document.getElementById('quizForm').style.display = 'none';
  document.getElementById('quizSuccess').classList.add('show');

  await performSignup(email, turnstileToken);
  track('quiz_signup');
  openVoteModal();
}

// Same as performSignup in index.html, plus linking this visitor's quiz answers to their entry.
async function performSignup(email, token) {
  const refCode = pageParams.get('ref');
  const referralCode = Math.random().toString(36).slice(2, 8);
  // Shared with the server-side Conversions API event so Meta dedupes the two into one conversion.
  const metaEventId = (crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `lw-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  try {
    const client = db();
    if (!client) throw new Error('Supabase library not loaded');
    const { data, error } = await client.functions.invoke('verify-signup', {
      body: {
        email,
        referral_code: referralCode,
        referred_by: refCode || null,
        bonus_votes: refCode ? 5 : 0,
        turnstile_token: token,
        meta_event_id: metaEventId,
      },
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);

    currentSubscriberEmail = email;
    sessionStorage.setItem('likewiseSubscriberEmail', email);

    if (refCode) {
      // Reward the referrer. A failure here is a missed bonus, not a broken signup, so it's not awaited.
      client.rpc('increment_bonus_votes', { p_code: refCode, p_amount: 10 });
    }
    // Reddit SignUp fires only here, once Supabase has confirmed the save; a failed save
    // falls through to the catch below and sends nothing. Guarded so a blocked pixel can't throw.
    if (typeof rdt === 'function') rdt('track', 'SignUp', { conversionId: metaEventId });
    linkQuizResponse(email);
  } catch (err) {
    console.error('Signup verification error:', err);
    // Data storage didn't save, the Mailchimp email capture below still goes through regardless.
  }

  submitToMailchimp(email, referralCode);
  window.gtag?.('event', 'sign_up', { method: 'quiz', quiz: quizKey });
  if (typeof fbq === 'function') fbq('track', 'Lead', {}, { eventID: metaEventId });
}

// Not awaited: the vote modal shouldn't wait on bookkeeping.
async function linkQuizResponse(email) {
  if (!state.savePromise || !(await state.savePromise)) return;
  const { error } = await db().rpc('link_quiz_response', { p_response_id: state.responseId, p_email: email });
  if (error) console.error('Quiz answer link error:', error);
}

// ── Mailchimp signup (submits via hidden iframe, page never navigates away) ──
function submitToMailchimp(email, referralCode) {
  const form = document.createElement('form');
  form.action = MAILCHIMP_ACTION;
  form.method = 'POST';
  form.target = 'mc-hidden-iframe';
  form.style.display = 'none';

  const fields = { EMAIL: email, REFCODE: referralCode, [MAILCHIMP_HONEYPOT]: '' };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

// ── Vote + suggestion modals (copy matches index.html) ───────────────
const VOTE_OPTIONS = [
  'Have you saved enough for your age?',
  'Do you carry credit card debt?',
  'Will your next mortgage be fixed or variable?',
  'How often do you buy lunch?',
  'Do you regularly invest or contribute to a TFSA, RRSP, or FHSA?',
  'How much should you give for a standard wedding gift?',
];

const MODALS_HTML = `
<div class="vote-modal-overlay" id="voteModalOverlay" role="dialog" aria-modal="true" aria-labelledby="voteModalTitle">
  <div class="vote-modal">
    <button type="button" class="vote-modal-x" data-action="close-vote" aria-label="Close">&times;</button>
    <div id="voteModalForm">
      <div class="vote-modal-kicker">You're in</div>
      <h3 class="vote-modal-title" id="voteModalTitle">Which question should Likewise ask first?</h3>
      <p class="vote-modal-sub">Help pick the very first question we ask at launch.</p>
      <div class="vote-opt-list" id="voteOptList">
        ${VOTE_OPTIONS.map(o => `<div class="vote-opt" data-action="select-vote"><span class="vote-opt-dot"></span>${esc(o)}</div>`).join('')}
        <div class="vote-opt vote-opt-other" data-action="select-vote">
          <div class="vote-opt-other-row"><span class="vote-opt-dot"></span>Other, write your own</div>
          <input type="text" class="vote-opt-other-input" id="voteOtherInput" placeholder="Type your question" maxlength="140">
        </div>
      </div>
      <button type="button" class="vote-modal-submit" data-action="submit-vote">Cast your vote</button>
      <p class="vote-modal-error" id="voteModalError">Pick a question first.</p>
    </div>
    <div class="vote-loading" id="voteLoading">
      <div class="vote-loading-bars" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="vote-loading-text">Casting your vote&hellip;</div>
    </div>
    <div class="vote-confirm" id="voteConfirm">
      <div class="vote-confirm-bars" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="vote-confirm-title">Thanks, your vote's in.</div>
      <p class="vote-confirm-sub">We'll let you know which question wins when Likewise launches.</p>
      <button type="button" class="vote-modal-submit" data-action="close-vote">Done</button>
    </div>
  </div>
</div>

<div class="vote-modal-overlay" id="suggestModalOverlay" role="dialog" aria-modal="true" aria-labelledby="suggestModalTitle">
  <div class="vote-modal">
    <button type="button" class="vote-modal-x" data-action="close-suggest" aria-label="Close">&times;</button>
    <div id="suggestModalForm">
      <div class="vote-modal-kicker">One more thing</div>
      <h3 class="vote-modal-title" id="suggestModalTitle">Got a question you wish we'd ask?</h3>
      <p class="vote-modal-sub">Tell us about any financial or lifestyle question you've always wondered how you compare on.</p>
      <textarea class="suggest-textarea" id="suggestInput" placeholder="Type your idea here&hellip;" maxlength="500"></textarea>
      <button type="button" class="vote-modal-submit" data-action="submit-suggest">Send it in</button>
      <button type="button" class="suggest-skip" data-action="close-suggest">Skip for now</button>
    </div>
    <div class="vote-confirm" id="suggestConfirm">
      <div class="vote-confirm-bars" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="vote-confirm-title">Thanks for sharing.</div>
      <p class="vote-confirm-sub">We read every idea that comes in.</p>
      <button type="button" class="vote-modal-submit" data-action="close-suggest">Done</button>
    </div>
  </div>
</div>
`;

function openVoteModal() {
  document.getElementById('voteModalOverlay').classList.add('show');
}
function closeVoteModal() {
  document.getElementById('voteModalOverlay').classList.remove('show');
  openSuggestModal();
}
function openSuggestModal() {
  document.getElementById('suggestModalOverlay').classList.add('show');
}
function closeSuggestModal() {
  document.getElementById('suggestModalOverlay').classList.remove('show');
}

function selectVoteOption(el) {
  document.querySelectorAll('#voteOptList .vote-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('voteModalError').classList.remove('show');
  if (el.classList.contains('vote-opt-other')) document.getElementById('voteOtherInput').focus();
}

async function submitVote() {
  const selected = document.querySelector('#voteOptList .vote-opt.selected');
  const errorEl = document.getElementById('voteModalError');

  if (!selected) {
    errorEl.textContent = 'Pick a question first.';
    errorEl.classList.add('show');
    return;
  }

  let voteText;
  if (selected.classList.contains('vote-opt-other')) {
    const otherInput = document.getElementById('voteOtherInput');
    voteText = otherInput.value.trim();
    if (!voteText) {
      errorEl.textContent = 'Type your question, or pick one from the list.';
      errorEl.classList.add('show');
      otherInput.focus();
      return;
    }
  } else {
    voteText = selected.textContent.trim();
  }

  document.getElementById('voteModalForm').style.display = 'none';
  document.getElementById('voteLoading').classList.add('show');

  const minDelay = new Promise(resolve => setTimeout(resolve, 700));
  const writeVote = (async () => {
    if (!currentSubscriberEmail) return;
    try {
      const { error } = await db().rpc('submit_vote', { p_email: currentSubscriberEmail, p_choice: voteText });
      if (error) throw error;
    } catch (err) {
      console.error('Supabase vote error:', err);
      // Fall through to the confirmation screen regardless, don't strand the user on a failed write.
    }
  })();

  await Promise.all([writeVote, minDelay]);

  window.gtag?.('event', 'question_vote', { question: voteText });
  document.getElementById('voteLoading').classList.remove('show');
  document.getElementById('voteConfirm').classList.add('show');
}

async function submitSuggestion() {
  const suggestion = document.getElementById('suggestInput').value.trim();
  if (!suggestion) {
    closeSuggestModal();
    return;
  }

  document.getElementById('suggestModalForm').style.display = 'none';

  try {
    if (currentSubscriberEmail) {
      const { error } = await db().rpc('submit_suggestion', { p_email: currentSubscriberEmail, p_suggestion: suggestion });
      if (error) throw error;
    }
  } catch (err) {
    console.error('Supabase suggestion error:', err);
    // Fall through to the confirmation screen regardless, don't strand the user on a failed write.
  }

  window.gtag?.('event', 'idea_submitted');
  document.getElementById('suggestConfirm').classList.add('show');
}

// ── Wiring ───────────────────────────────────────────────────────────
const ACTIONS = {
  'close-vote': closeVoteModal,
  'close-suggest': closeSuggestModal,
  'submit-vote': submitVote,
  'submit-suggest': submitSuggestion,
};

document.addEventListener('click', e => {
  const answer = e.target.closest('.quiz-answer');
  if (answer) return chooseAnswer(answer);
  if (e.target.closest('.quiz-back')) return showQuestion(state.step - 1);
  if (e.target.closest('#voteOtherInput')) return;

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  if (actionEl.dataset.action === 'select-vote') return selectVoteOption(actionEl);
  ACTIONS[actionEl.dataset.action]?.();
});

document.addEventListener('submit', e => {
  if (e.target.id === 'quizForm') handleSignup(e);
});

document.addEventListener('input', e => {
  if (e.target.id === 'voteOtherInput') document.getElementById('voteModalError').classList.remove('show');
});

// ── Start ────────────────────────────────────────────────────────────
if (quiz) {
  renderShell();
  showQuestion(0);
} else {
  root.innerHTML = '<p style="padding:48px 20px;text-align:center">This quiz isn\'t available. <a href="/">Join the Likewise waitlist</a></p>';
  console.error('Likewise quiz: no quiz named "' + quizKey + '" in questions.js');
}
