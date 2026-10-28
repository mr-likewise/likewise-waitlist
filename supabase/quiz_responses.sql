-- Likewise quiz landing pages (/q/*): storage for anonymous quiz answers.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run more than once. It only adds a new table and a new function; it does not
-- change the existing subscribers table or any existing function.
--
-- What it stores per quiz completion: which quiz, the questions + answers, the ad's UTM tags,
-- and a timestamp. No email, name or IP. If that visitor then joins the waitlist, their row
-- gets their waitlist email filled in, which links the answers to their subscribers entry.

create table if not exists public.quiz_responses (
  id               uuid primary key default gen_random_uuid(),
  quiz             text not null check (char_length(quiz) <= 50),
  answers          jsonb not null check (pg_column_size(answers) <= 4000),
  utm_source       text check (char_length(utm_source) <= 200),
  utm_medium       text check (char_length(utm_medium) <= 200),
  utm_campaign     text check (char_length(utm_campaign) <= 200),
  utm_content      text check (char_length(utm_content) <= 200),
  utm_term         text check (char_length(utm_term) <= 200),
  created_at       timestamptz not null default now(),
  -- Filled in only by link_quiz_response() below, after a successful waitlist signup.
  subscriber_email text,
  linked_at        timestamptz
);

create index if not exists quiz_responses_quiz_created_idx on public.quiz_responses (quiz, created_at);
create index if not exists quiz_responses_subscriber_email_idx on public.quiz_responses (subscriber_email);

-- Row Level Security: the public website may ADD rows, and nothing else.
-- It cannot read, change or delete anyone's answers, and cannot set the email or timestamp itself.
alter table public.quiz_responses enable row level security;

revoke all on public.quiz_responses from anon, authenticated;
grant insert (id, quiz, answers, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  on public.quiz_responses to anon, authenticated;

drop policy if exists "Website can save anonymous quiz answers" on public.quiz_responses;
create policy "Website can save anonymous quiz answers"
  on public.quiz_responses for insert
  to anon, authenticated
  with check (subscriber_email is null and linked_at is null);

-- Links one quiz response to a waitlist signup. Called by the quiz page right after signup.
-- Only links a response that is unlinked, less than a day old, and only to an email that is
-- actually in subscribers, so it can't be used to attach arbitrary text to anyone's answers.
create or replace function public.link_quiz_response(p_response_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quiz_responses q
     set subscriber_email = lower(trim(p_email)),
         linked_at = now()
   where q.id = p_response_id
     and q.subscriber_email is null
     and q.created_at > now() - interval '1 day'
     and exists (
       select 1 from public.subscribers s
        where lower(trim(s.email)) = lower(trim(p_email))
     );
end;
$$;

revoke all on function public.link_quiz_response(uuid, text) from public;
grant execute on function public.link_quiz_response(uuid, text) to anon, authenticated;

-- Handy queries for later (copy one into a new SQL Editor tab):
--
-- Answers per quiz:
--   select quiz, answers->0->>'answer' as q1, answers->1->>'answer' as q2, count(*)
--   from quiz_responses group by 1,2,3 order by 1, 4 desc;
--
-- Completions vs signups per quiz and ad:
--   select quiz, utm_campaign, utm_content, count(*) as completed,
--          count(subscriber_email) as signed_up
--   from quiz_responses group by 1,2,3 order by 1, 4 desc;
