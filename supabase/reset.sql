-- Clean start for a demo rehearsal.
-- Removes everything the agent produced during a run and leaves the seeded
-- data in place: companies, people, transcripts, and the activities that came
-- from the calendar and from the transcripts.
-- Run this before each judging round (task G19).

begin;

delete from public.approvals;
delete from public.candidates;
delete from public.findings;
delete from public.interview_questions;
delete from public.voice_notes;
delete from public.activities where source = 'voice';

-- The scoring scenario writes a category onto every activity it looks at.
-- Clear it so the next run starts from nothing.
update public.activities set category = null where category is not null;

commit;

-- Deeper reset, normally not needed.
-- Scenario one deletes and rewrites the calendar activities on every run, so
-- those look after themselves. Scenario two adds transcript activities without
-- clearing the old ones first, so uncomment this if a rehearsal shows the same
-- call twice.
-- delete from public.activities where source = 'transcript';

-- What is left after a reset. Expect the seeded counts and nothing else.
select 'companies'   as table_name, count(*) from public.companies
union all select 'people',              count(*) from public.people
union all select 'transcripts',         count(*) from public.transcripts
union all select 'activities',          count(*) from public.activities
union all select 'voice_notes',         count(*) from public.voice_notes
union all select 'interview_questions', count(*) from public.interview_questions
union all select 'findings',            count(*) from public.findings
union all select 'candidates',          count(*) from public.candidates
union all select 'approvals',           count(*) from public.approvals;
