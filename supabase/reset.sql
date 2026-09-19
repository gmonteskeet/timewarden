-- Clean start: puts the database back to the morning of the demo.
-- Run this before each judging round, then run the morning routine once so a
-- fresh email is waiting.
--
-- It removes everything the demo itself produces and keeps everything that was
-- seeded: the company, the roles and their topics, the four people, the three
-- weeks of approved history, and the calendar and transcript activities.
--
-- The demo day is Friday 18 September 2026, the same value as
-- NEXT_PUBLIC_DEMO_DAY. Change it in one place here if that ever moves.

begin;

-- 1. The demo day check ins, for everyone, not only Elena.
--    interview_turns and day_allocations go with them, by foreign key.
delete from public.check_ins where day = date '2026-09-18';

-- 2. The activities the day summary wrote back from the interview.
--    Calendar and transcript activities stay: the morning routine replaces
--    those itself, and they are what Scout is supposed to already know.
delete from public.activities
  where source = 'interview' and day = date '2026-09-18';

-- 3. Suggestions and the decisions taken on them.
delete from public.approvals;
delete from public.candidates;

-- 4. Every role goes back to a proposed split, waiting for the manager.
--    This is the first human approval the judges see, so it has to be there.
update public.topics t
  set expected_percent = t.proposed_percent
  where t.expected_percent is distinct from t.proposed_percent;

update public.roles
  set split_status = 'proposed',
      split_approved_by = null,
      split_approved_at = null;

commit;

-- What is left. The history and the seeded data should be untouched, and the
-- four demo day columns should all be zero.
select 'companies'              as table_name, count(*) from public.companies
union all select 'roles',              count(*) from public.roles
union all select 'topics',             count(*) from public.topics
union all select 'people',             count(*) from public.people
union all select 'transcripts',        count(*) from public.transcripts
union all select 'activities kept',    count(*) from public.activities
union all select 'history check ins',  count(*) from public.check_ins
union all select 'demo day check ins', count(*) from public.check_ins where day = date '2026-09-18'
union all select 'interview turns',    count(*) from public.interview_turns
union all select 'candidates',         count(*) from public.candidates
union all select 'approvals',          count(*) from public.approvals
union all select 'roles awaiting approval', count(*) from public.roles where split_status = 'proposed';
