// ─────────────────────────────────────────────────────────────────────────
// LIKEWISE QUIZ QUESTIONS — this is the only file you need to edit.
//
// Each block below is one quiz page. The name before the colon (e.g. tipping)
// must match the page's address (joinlikewise.ca/q/tipping).
//
// To change wording:   edit the text inside the quotes. Keep the quotes and commas.
// To add an answer:     add another 'Quoted text', to the answers list.
// To add a question:    copy a whole { id: ..., text: ..., answers: [...] }, block,
//                       paste it after the last one, and give it a new id (q3, q4...).
// To fill in a stat:    replace the [STAT NEEDED: ...] text with the real sentence,
//                       e.g. 'Most Canadians tip 15%.' Placeholders show up highlighted
//                       in yellow on the page so you can't miss one.
// source:               who published the stat and when, shown in small text under it,
//                       e.g. 'Narrative Research, August 2024'. Delete the line to hide it.
// compareTo:            which question's answer appears under the stat as
//                       "You said: ...". 1 = first question, 2 = second, and so on.
//
// Tip: if you rename a question id (q1, q2) after launch, older answers saved in
// Supabase keep the old id, so it's easiest to leave ids alone.
//
// To add a brand-new quiz page: add a block here, then copy the folder
// q/tipping to q/your-new-name and, in its index.html, change
// data-quiz="tipping" to data-quiz="your-new-name" and update the <title>.
// ─────────────────────────────────────────────────────────────────────────

window.LIKEWISE_QUIZZES = {

  tipping: {
    kicker: 'Tipping',
    questions: [
      {
        id: 'q1',
        text: 'What do you usually tip at a sit-down restaurant?',
        answers: ['Under 15%', '15%', '18%', '20%', 'More than 20%'],
      },
      {
        id: 'q2',
        text: 'Does the tip screen pressure you?',
        answers: ['Every time', 'Sometimes', 'Not really'],
      },
    ],
    result: {
      stat: 'Most Canadians tip 15% for good service at a sit-down restaurant.',
      source: 'Narrative Research, August 2024',
      compareTo: 1,
    },
  },

  subscriptions: {
    kicker: 'Subscriptions',
    questions: [
      {
        id: 'q1',
        text: 'How many subscriptions are you paying for right now?',
        answers: ['0-2', '3-5', '6-9', '10+'],
      },
      {
        id: 'q2',
        text: 'Are you actually using all of them?',
        answers: ['Yes', 'Most of them', 'Honestly, no'],
      },
    ],
    result: {
      stat: 'Canadians guess they have about 4 subscriptions. When they actually count, it’s 8.',
      source: 'Hardbacon survey, March 2024',
      compareTo: 1,
    },
  },

  rent: {
    kicker: 'Rent',
    questions: [
      {
        id: 'q1',
        text: 'How much of your take-home pay goes to rent or mortgage?',
        answers: ['Under 25%', '25-35%', '35-50%', 'Over 50%', "I don't pay rent or a mortgage"],
      },
      {
        id: 'q2',
        text: 'How does that feel?',
        answers: ['Comfortable', 'A bit stretched', 'Barely making it'],
      },
    ],
    result: {
      stat: 'About 1 in 3 Canadian renters spend more than half their income on rent.',
      source: 'Rentals.ca survey, August 2025',
      compareTo: 1,
    },
  },

  'money-talk': {
    kicker: 'Money talk',
    questions: [
      {
        id: 'q1',
        text: 'Do you know what your closest friend earns?',
        answers: ['Yes, exactly', 'Roughly', 'No idea'],
      },
      {
        id: 'q2',
        text: 'Would you tell them what you make?',
        answers: ['Yes', 'Maybe', 'Never'],
      },
    ],
    result: {
      stat: 'Only 38% of Canadians are comfortable talking about pay with their friends.',
      source: 'Leger for Talent.com, January 2023',
      compareTo: 2,
    },
  },

};
