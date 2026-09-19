-- Workflow Scout: initial schema
-- Tables and columns follow AGENTS.md section 5 exactly.
-- Row level security is on everywhere with public read only. Every write goes
-- through make.com or a server route using the service key, which bypasses
-- row level security. This is safe only because all rows are made up data.

create extension if not exists pgcrypto;

-- companies ------------------------------------------------------------------
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint companies_name_key unique (name)
);

-- people ---------------------------------------------------------------------
create table if not exists public.people (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  full_name            text not null,
  role_title           text not null,
  team                 text,
  manager_id           uuid references public.people (id) on delete set null,
  job_description      text,
  performance_criteria jsonb not null default '[]'::jsonb,
  hourly_cost_eur      numeric,
  calendar_id          text,
  created_at           timestamptz not null default now(),
  constraint people_company_full_name_key unique (company_id, full_name),
  constraint people_performance_criteria_is_array check (jsonb_typeof(performance_criteria) = 'array')
);

-- activities -----------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people (id) on delete cascade,
  source      text not null,
  title       text not null,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  minutes     int not null default 0,
  attendees   jsonb not null default '[]'::jsonb,
  category    text,
  week_start  date not null,
  created_at  timestamptz not null default now(),
  constraint activities_source_check check (source in ('calendar', 'transcript', 'voice')),
  constraint activities_attendees_is_array check (jsonb_typeof(attendees) = 'array')
);

-- transcripts ----------------------------------------------------------------
create table if not exists public.transcripts (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people (id) on delete cascade,
  title       text not null,
  occurred_at timestamptz not null,
  minutes     int not null default 0,
  in_calendar boolean not null default false,
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint transcripts_person_title_occurred_key unique (person_id, title, occurred_at)
);

-- voice_notes ----------------------------------------------------------------
create table if not exists public.voice_notes (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.people (id) on delete cascade,
  week_start      date not null,
  transcript_text text not null,
  status          text not null default 'received',
  created_at      timestamptz not null default now(),
  constraint voice_notes_status_check check (status in ('received', 'processed'))
);

-- interview_questions --------------------------------------------------------
create table if not exists public.interview_questions (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people (id) on delete cascade,
  week_start  date not null,
  kind        text not null,
  question    text not null,
  evidence    text,
  answer      text,
  answered_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint interview_questions_kind_check check (kind in ('unexplained_meeting', 'calendar_gap', 'mismatch'))
);

-- findings -------------------------------------------------------------------
create table if not exists public.findings (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references public.people (id) on delete cascade,
  week_start          date not null,
  category            text not null,
  said_minutes        int not null default 0,
  seen_minutes        int not null default 0,
  in_job_description  boolean not null default false,
  summary             text,
  employee_verdict    text not null default 'pending',
  employee_comment    text,
  manager_verdict     text not null default 'pending',
  manager_comment     text,
  created_at          timestamptz not null default now(),
  constraint findings_employee_verdict_check check (employee_verdict in ('pending', 'agree', 'disagree')),
  constraint findings_manager_verdict_check check (manager_verdict in ('pending', 'agree', 'disagree'))
);

-- candidates -----------------------------------------------------------------
create table if not exists public.candidates (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  person_id            uuid references public.people (id) on delete set null,
  title                text not null,
  description          text,
  hours_per_week       numeric,
  annual_cost_eur      numeric,
  score_time           int,
  score_repetitive     int,
  score_reliability    int,
  score_role_distance  int,
  total_score          numeric,
  rank                 int,
  reasoning            text,
  proposed_steps       jsonb not null default '[]'::jsonb,
  status               text not null default 'proposed',
  make_scenario_id     text,
  make_scenario_url    text,
  created_at           timestamptz not null default now(),
  constraint candidates_status_check check (status in ('proposed', 'approved', 'rejected', 'drafted')),
  constraint candidates_score_time_check check (score_time between 1 and 5),
  constraint candidates_score_repetitive_check check (score_repetitive between 1 and 5),
  constraint candidates_score_reliability_check check (score_reliability between 1 and 5),
  constraint candidates_score_role_distance_check check (score_role_distance between 1 and 5),
  constraint candidates_proposed_steps_is_array check (jsonb_typeof(proposed_steps) = 'array')
);

-- approvals ------------------------------------------------------------------
create table if not exists public.approvals (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  approver_id  uuid references public.people (id) on delete set null,
  decision     text not null,
  comment      text,
  created_at   timestamptz not null default now(),
  constraint approvals_decision_check check (decision in ('approved', 'rejected'))
);

-- indexes --------------------------------------------------------------------
create index if not exists people_company_id_idx            on public.people (company_id);
create index if not exists people_manager_id_idx            on public.people (manager_id);
create index if not exists activities_person_id_idx         on public.activities (person_id);
create index if not exists activities_week_start_idx        on public.activities (week_start);
create index if not exists activities_person_week_src_idx   on public.activities (person_id, week_start, source);
create index if not exists transcripts_person_id_idx        on public.transcripts (person_id);
create index if not exists voice_notes_person_id_idx        on public.voice_notes (person_id);
create index if not exists voice_notes_week_start_idx       on public.voice_notes (week_start);
create index if not exists interview_questions_person_id_idx  on public.interview_questions (person_id);
create index if not exists interview_questions_week_start_idx on public.interview_questions (week_start);
create index if not exists findings_person_id_idx           on public.findings (person_id);
create index if not exists findings_week_start_idx          on public.findings (week_start);
create index if not exists candidates_person_id_idx         on public.candidates (person_id);
create index if not exists candidates_company_id_idx        on public.candidates (company_id);
create index if not exists approvals_candidate_id_idx       on public.approvals (candidate_id);

-- row level security ---------------------------------------------------------
-- Read is public. There is no insert, update or delete policy anywhere, so the
-- anonymous key can only read. The service key ignores these policies.
alter table public.companies           enable row level security;
alter table public.people              enable row level security;
alter table public.activities          enable row level security;
alter table public.transcripts         enable row level security;
alter table public.voice_notes         enable row level security;
alter table public.interview_questions enable row level security;
alter table public.findings            enable row level security;
alter table public.candidates          enable row level security;
alter table public.approvals           enable row level security;

drop policy if exists "public read companies"           on public.companies;
drop policy if exists "public read people"              on public.people;
drop policy if exists "public read activities"          on public.activities;
drop policy if exists "public read transcripts"         on public.transcripts;
drop policy if exists "public read voice notes"         on public.voice_notes;
drop policy if exists "public read interview questions" on public.interview_questions;
drop policy if exists "public read findings"            on public.findings;
drop policy if exists "public read candidates"          on public.candidates;
drop policy if exists "public read approvals"           on public.approvals;

create policy "public read companies"           on public.companies           for select to anon using (true);
create policy "public read people"              on public.people              for select to anon using (true);
create policy "public read activities"          on public.activities          for select to anon using (true);
create policy "public read transcripts"         on public.transcripts         for select to anon using (true);
create policy "public read voice notes"         on public.voice_notes         for select to anon using (true);
create policy "public read interview questions" on public.interview_questions for select to anon using (true);
create policy "public read findings"            on public.findings            for select to anon using (true);
create policy "public read candidates"          on public.candidates          for select to anon using (true);
create policy "public read approvals"           on public.approvals           for select to anon using (true);

-- grants ---------------------------------------------------------------------
-- A Supabase project already grants these to the anonymous role by default.
-- They are written out so the migration stands on its own and can be tested
-- against a plain Postgres database. Row level security above is what actually
-- refuses a write, not the absence of a grant.
grant usage on schema public to anon;
grant select on all tables in schema public to anon;
