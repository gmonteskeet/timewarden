-- Workflow Scout: version 1 to version 2.
-- Runs on top of migration 0001. Tables and columns follow AGENTS.md (version 2)
-- section 5.
--
-- Version 2 has users and rights, so there is no public read access any more.
-- Row level security stays on for every table with no policies at all, and the
-- anonymous role loses the grants migration 0001 gave it. Only the service key
-- reaches the data, and it is held by the Next.js server and by make.com.

-- 1. Tables that version 2 does not use -----------------------------------
drop table if exists public.voice_notes cascade;
drop table if exists public.interview_questions cascade;
drop table if exists public.findings cascade;

-- 2. roles ------------------------------------------------------------------
create table if not exists public.roles (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  title              text not null,
  document_name      text,
  document_url       text,
  job_description    text,
  kpis               jsonb not null default '[]'::jsonb,
  split_status       text not null default 'proposed',
  split_approved_by  uuid references public.people (id) on delete set null,
  split_approved_at  timestamptz,
  source_read_at     timestamptz,
  created_at         timestamptz not null default now(),
  constraint roles_company_title_key unique (company_id, title),
  constraint roles_split_status_check check (split_status in ('proposed', 'approved')),
  constraint roles_kpis_is_array check (jsonb_typeof(kpis) = 'array')
);

-- 3. topics -----------------------------------------------------------------
-- One role's expected_percent values always add up to 100. See the trigger at
-- the end of this file.
create table if not exists public.topics (
  id                uuid primary key default gen_random_uuid(),
  role_id           uuid not null references public.roles (id) on delete cascade,
  name              text not null,
  description       text,
  expected_percent  numeric not null default 0,
  proposed_percent  numeric not null default 0,
  reasoning         text,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  constraint topics_role_name_key unique (role_id, name),
  constraint topics_expected_percent_range check (expected_percent >= 0 and expected_percent <= 100),
  constraint topics_proposed_percent_range check (proposed_percent >= 0 and proposed_percent <= 100)
);

-- 4. people: the version 2 columns -------------------------------------------
-- email is deliberately not unique. For the demo more than one person can point
-- at the same inbox.
alter table public.people add column if not exists role_id uuid references public.roles (id) on delete set null;
alter table public.people add column if not exists email text;
alter table public.people add column if not exists app_role text not null default 'employee';
alter table public.people add column if not exists access_token text not null default encode(gen_random_bytes(24), 'hex');
alter table public.people add column if not exists working_minutes_per_day int not null default 480;

alter table public.people drop column if exists role_title;
alter table public.people drop column if exists job_description;
alter table public.people drop column if exists performance_criteria;

do $$ begin
  alter table public.people add constraint people_app_role_check check (app_role in ('manager', 'employee'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.people add constraint people_access_token_key unique (access_token);
exception when duplicate_table then null; end $$;

-- 5. activities: a day rather than a week ------------------------------------
alter table public.activities add column if not exists day date;
update public.activities set day = week_start where day is null and week_start is not null;
delete from public.activities where day is null;
alter table public.activities alter column day set not null;

alter table public.activities drop column if exists week_start;
alter table public.activities drop column if exists category;

alter table public.activities drop constraint if exists activities_source_check;
delete from public.activities where source not in ('calendar', 'transcript', 'interview');
alter table public.activities add constraint activities_source_check
  check (source in ('calendar', 'transcript', 'interview'));

-- 6. check_ins ---------------------------------------------------------------
create table if not exists public.check_ins (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references public.people (id) on delete cascade,
  day              date not null,
  status           text not null default 'invited',
  invited_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  approved_by      uuid references public.people (id) on delete set null,
  approved_at      timestamptz,
  manager_comment  text,
  summary_text     text,
  created_at       timestamptz not null default now(),
  constraint check_ins_person_day_key unique (person_id, day),
  constraint check_ins_status_check check (status in ('invited', 'in_progress', 'summarised', 'submitted', 'approved', 'returned'))
);

-- 7. interview_turns ---------------------------------------------------------
create table if not exists public.interview_turns (
  id            uuid primary key default gen_random_uuid(),
  check_in_id   uuid not null references public.check_ins (id) on delete cascade,
  turn_no       int not null,
  speaker       text not null,
  text          text not null,
  kind          text,
  evidence      text,
  created_at    timestamptz not null default now(),
  constraint interview_turns_speaker_check check (speaker in ('scout', 'employee')),
  constraint interview_turns_kind_check check (
    kind is null or kind in ('opening', 'calendar_gap', 'unexplained_meeting', 'elaboration', 'confirmation', 'closing')
  )
);

-- 8. day_allocations ---------------------------------------------------------
-- label holds the topic name when topic_id is set, and otherwise a short plain
-- name for work outside the role, for example "Manual status reporting".
create table if not exists public.day_allocations (
  id                 uuid primary key default gen_random_uuid(),
  check_in_id        uuid not null references public.check_ins (id) on delete cascade,
  person_id          uuid not null references public.people (id) on delete cascade,
  day                date not null,
  topic_id           uuid references public.topics (id) on delete set null,
  label              text not null,
  in_role            boolean not null default true,
  minutes            int not null default 0,
  percent            numeric not null default 0,
  evidence           text,
  employee_adjusted  boolean not null default false,
  created_at         timestamptz not null default now()
);

-- 9. candidates: a team level suggestion, not a person level one --------------
alter table public.candidates drop column if exists person_id;
alter table public.candidates add column if not exists source_label text;
alter table public.candidates add column if not exists people_affected int;
alter table public.candidates add column if not exists period_start date;
alter table public.candidates add column if not exists period_end date;

-- 10. indexes ----------------------------------------------------------------
drop index if exists public.activities_week_start_idx;
drop index if exists public.activities_person_week_src_idx;

create index if not exists roles_company_id_idx           on public.roles (company_id);
create index if not exists topics_role_id_idx             on public.topics (role_id);
create index if not exists people_role_id_idx             on public.people (role_id);
create index if not exists activities_day_idx             on public.activities (day);
create index if not exists activities_person_day_src_idx  on public.activities (person_id, day, source);
create index if not exists check_ins_person_id_idx        on public.check_ins (person_id);
create index if not exists check_ins_day_idx              on public.check_ins (day);
create index if not exists check_ins_status_idx           on public.check_ins (status);
create index if not exists interview_turns_check_in_idx   on public.interview_turns (check_in_id, turn_no);
create index if not exists day_allocations_check_in_idx   on public.day_allocations (check_in_id);
create index if not exists day_allocations_person_id_idx  on public.day_allocations (person_id);
create index if not exists day_allocations_day_idx        on public.day_allocations (day);
create index if not exists day_allocations_topic_id_idx   on public.day_allocations (topic_id);

-- 11. a role's expected split always adds up to 100 --------------------------
-- Deferred, so a scenario or the seed script can delete a role's topics and
-- write the new ones inside one transaction without tripping over itself.
-- A role with no topics at all is allowed: make.com replaces topics with a
-- delete call followed by an insert call, and those are separate transactions.
create or replace function public.check_role_split_totals()
returns trigger
language plpgsql
as $$
declare
  role_ids uuid[];
  role_to_check uuid;
  topic_count int;
  total numeric;
begin
  if tg_op = 'DELETE' then
    role_ids := array[old.role_id];
  elsif tg_op = 'INSERT' then
    role_ids := array[new.role_id];
  else
    role_ids := array[new.role_id, old.role_id];
  end if;

  foreach role_to_check in array role_ids loop
    select count(*), coalesce(sum(expected_percent), 0)
      into topic_count, total
      from public.topics
      where role_id = role_to_check;

    if topic_count > 0 and abs(total - 100) > 0.01 then
      raise exception
        'The topics for role % add up to % percent. They must add up to 100.',
        role_to_check, total;
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists topics_split_totals_check on public.topics;
create constraint trigger topics_split_totals_check
  after insert or update or delete on public.topics
  deferrable initially deferred
  for each row execute function public.check_role_split_totals();

-- 12. row level security: on everywhere, no policies anywhere ----------------
alter table public.roles             enable row level security;
alter table public.topics            enable row level security;
alter table public.check_ins         enable row level security;
alter table public.interview_turns   enable row level security;
alter table public.day_allocations   enable row level security;

drop policy if exists "public read companies"    on public.companies;
drop policy if exists "public read people"       on public.people;
drop policy if exists "public read activities"   on public.activities;
drop policy if exists "public read transcripts"  on public.transcripts;
drop policy if exists "public read candidates"   on public.candidates;
drop policy if exists "public read approvals"    on public.approvals;

-- Take back what migration 0001 granted, and stop Supabase's own defaults from
-- handing new tables to the anonymous role later on.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke usage on schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
