-- Workflow Scout: the context the interview and the day summary need.
--
-- Scenario four has to answer inside twelve seconds. Fetching the check in,
-- the person, the role, the approved topics, the day's activities and the
-- interview so far as separate calls from make.com is six round trips before
-- Claude is even asked. These functions do it in one, and hand back the user
-- message for the Claude module already written as JSON text, so make.com maps
-- one field instead of eight.
--
-- Everything that decides anything stays in make.com: the six question cap,
-- the Claude call, the arithmetic on the minutes and every write bar the
-- employee's own answer. These functions read, and record the answer that was
-- just given so that the model can see it in the same round trip.
--
-- Only the service key reaches them. Execute is taken off PUBLIC, and the
-- anonymous role lost usage on the schema in migration 0002.

-- 1. One timestamp, written the way the prompts expect -----------------------
-- ISO 8601 in Madrid time, for example 2026-09-18T11:00:00+02:00. AGENTS.md
-- section 8 fixes the timezone to Europe/Madrid.
create or replace function public.scout_madrid_iso(p_ts timestamptz)
returns text
language sql
stable
set timezone to 'Europe/Madrid'
as $$
  select case
    when p_ts is null then null
    else to_char(p_ts, 'YYYY-MM-DD"T"HH24:MI:SS')
         || case
              when to_char(p_ts, 'OF') like '%:%' then to_char(p_ts, 'OF')
              else to_char(p_ts, 'OF') || ':00'
            end
  end;
$$;

comment on function public.scout_madrid_iso(timestamptz) is
  'One timestamp as ISO 8601 in Madrid time, for the interview and summary prompts.';

-- 2. Everything both scenarios need, in one object ---------------------------
-- Read only. The two functions below pick from it and build the user message
-- for their own prompt.
create or replace function public.scout_day_context(p_check_in_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok',               true,
    'check_in_id',      ci.id,
    'person_id',        p.id,
    'company_id',       p.company_id,
    'role_id',          r.id,
    'person_name',      p.full_name,
    'first_name',       split_part(p.full_name, ' ', 1),
    'role_title',       coalesce(r.title, ''),
    'split_status',     coalesce(r.split_status, 'proposed'),
    'day',              to_char(ci.day, 'YYYY-MM-DD'),
    'status',           ci.status,
    'working_minutes',  p.working_minutes_per_day,

    -- The role's topics, as the prompts want them.
    'topics', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name',             t.name,
                 'description',      coalesce(t.description, ''),
                 'expected_percent', t.expected_percent
               )
               order by t.sort_order, t.name)
        from public.topics t
       where t.role_id = r.id
    ), '[]'::jsonb),

    -- The same topics with their ids, so make.com can turn a topic_name from
    -- Claude back into a topic_id when it writes the allocations.
    'topic_map', coalesce((
      select jsonb_agg(
               jsonb_build_object('name', t.name, 'topic_id', t.id)
               order by t.sort_order, t.name)
        from public.topics t
       where t.role_id = r.id
    ), '[]'::jsonb),

    'calendar_activities', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'title',       a.title,
                 'description', a.description,
                 'starts_at',   public.scout_madrid_iso(a.starts_at),
                 'ends_at',     public.scout_madrid_iso(a.ends_at),
                 'minutes',     a.minutes,
                 'attendees',   a.attendees
               )
               order by a.starts_at nulls last, a.title)
        from public.activities a
       where a.person_id = ci.person_id
         and a.day = ci.day
         and a.source = 'calendar'
    ), '[]'::jsonb),

    -- in_calendar is what reveals unplanned work. Take it from the transcript
    -- row when the intake scenario lined the two up, and otherwise work it out
    -- from whether any calendar entry covers the same stretch of the day.
    'transcript_activities', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'title',       a.title,
                 'description', a.description,
                 'starts_at',   public.scout_madrid_iso(a.starts_at),
                 'ends_at',     public.scout_madrid_iso(a.ends_at),
                 'minutes',     a.minutes,
                 'attendees',   a.attendees,
                 'in_calendar', coalesce(
                   (select tr.in_calendar
                      from public.transcripts tr
                     where tr.person_id = a.person_id
                       and tr.occurred_at = a.starts_at
                     limit 1),
                   exists (
                     select 1
                       from public.activities c
                      where c.person_id = a.person_id
                        and c.day = a.day
                        and c.source = 'calendar'
                        and c.starts_at < a.ends_at
                        and c.ends_at > a.starts_at
                   )
                 )
               )
               order by a.starts_at nulls last, a.title)
        from public.activities a
       where a.person_id = ci.person_id
         and a.day = ci.day
         and a.source = 'transcript'
    ), '[]'::jsonb),

    'turns', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'turn_no',  it.turn_no,
                 'speaker',  it.speaker,
                 'text',     it.text,
                 'kind',     it.kind,
                 'evidence', it.evidence
               )
               order by it.turn_no)
        from public.interview_turns it
       where it.check_in_id = ci.id
    ), '[]'::jsonb),

    'scout_turns_asked', (
      select count(*)
        from public.interview_turns it
       where it.check_in_id = ci.id
         and it.speaker = 'scout'
    ),

    'next_turn_no', (
      select coalesce(max(it.turn_no), 0) + 1
        from public.interview_turns it
       where it.check_in_id = ci.id
    ),

    -- Outside role labels this company has already used, so the summary reuses
    -- a name instead of inventing a new one and splitting the history in two.
    -- This check in's own labels are left out, so a second run of the summary
    -- is not steered by its first.
    'known_outside_labels', coalesce((
      select jsonb_agg(distinct da.label)
        from public.day_allocations da
        join public.people dp on dp.id = da.person_id
       where dp.company_id = p.company_id
         and da.in_role = false
         and da.check_in_id <> ci.id
    ), '[]'::jsonb)
  )
    from public.check_ins ci
    join public.people p  on p.id = ci.person_id
    left join public.roles r on r.id = p.role_id
   where ci.id = p_check_in_id;
$$;

comment on function public.scout_day_context(uuid) is
  'Everything scenarios four and five need about one check in, in one read.';

-- 3. Scenario four: one interview turn ---------------------------------------
-- Records the employee's answer first, when there is one, so that the model
-- sees it in turns_so_far in the same round trip. Everything else is a read.
create or replace function public.scout_interview_context(
  p_check_in_id   uuid,
  p_employee_text text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_ctx    jsonb;
begin
  select ci.status into v_status
    from public.check_ins ci
   where ci.id = p_check_in_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'There is no check in with that id.'
    );
  end if;

  -- The employee has answered the previous question.
  if p_employee_text is not null and btrim(p_employee_text) <> '' then
    insert into public.interview_turns (check_in_id, turn_no, speaker, text)
    select p_check_in_id,
           coalesce(max(it.turn_no), 0) + 1,
           'employee',
           btrim(p_employee_text)
      from public.interview_turns it
     where it.check_in_id = p_check_in_id;

    if v_status = 'invited' then
      update public.check_ins
         set status = 'in_progress'
       where id = p_check_in_id;
    end if;
  end if;

  v_ctx := public.scout_day_context(p_check_in_id);

  return jsonb_build_object(
    'ok',                true,
    'check_in_id',       v_ctx -> 'check_in_id',
    'person_id',         v_ctx -> 'person_id',
    'first_name',        v_ctx -> 'first_name',
    'day',               v_ctx -> 'day',
    'status',            v_ctx -> 'status',
    'split_status',      v_ctx -> 'split_status',
    'working_minutes',   v_ctx -> 'working_minutes',
    'scout_turns_asked', v_ctx -> 'scout_turns_asked',
    'next_turn_no',      v_ctx -> 'next_turn_no',
    -- Ready to drop straight into the user message of the Claude module.
    -- The fields are exactly those listed for prompts/02_interview_turn.md.
    'prompt_input', (jsonb_build_object(
      'person_name',           v_ctx -> 'person_name',
      'role_title',            v_ctx -> 'role_title',
      'topics',                v_ctx -> 'topics',
      'day',                   v_ctx -> 'day',
      'working_minutes',       v_ctx -> 'working_minutes',
      'calendar_activities',   v_ctx -> 'calendar_activities',
      'transcript_activities', v_ctx -> 'transcript_activities',
      'turns_so_far',          v_ctx -> 'turns'
    ))::text
  );
end;
$$;

comment on function public.scout_interview_context(uuid, text) is
  'Scenario four: record the employee answer if there is one, then return the interview context and the ready made user message.';

-- 4. Scenario five: the day summary ------------------------------------------
create or replace function public.scout_summary_context(p_check_in_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when v.ctx is null then jsonb_build_object(
      'ok', false,
      'error', 'There is no check in with that id.'
    )
    else jsonb_build_object(
      'ok',              true,
      'check_in_id',     v.ctx -> 'check_in_id',
      'person_id',       v.ctx -> 'person_id',
      'day',             v.ctx -> 'day',
      'status',          v.ctx -> 'status',
      'working_minutes', v.ctx -> 'working_minutes',
      'topic_map',       v.ctx -> 'topic_map',
      -- The fields listed for prompts/03_day_summary.md, and no others.
      'prompt_input', (jsonb_build_object(
        'person_name',           v.ctx -> 'person_name',
        'role_title',            v.ctx -> 'role_title',
        'topics',                v.ctx -> 'topics',
        'day',                   v.ctx -> 'day',
        'working_minutes',       v.ctx -> 'working_minutes',
        'calendar_activities',   v.ctx -> 'calendar_activities',
        'transcript_activities', v.ctx -> 'transcript_activities',
        'interview',             v.ctx -> 'turns',
        'known_outside_labels',  v.ctx -> 'known_outside_labels'
      ))::text
    )
  end
  from (select public.scout_day_context(p_check_in_id) as ctx) v;
$$;

comment on function public.scout_summary_context(uuid) is
  'Scenario five: the same context as the interview, with the full interview and the labels already used for work outside a role.';

-- 5. Only the service key may call these -------------------------------------
-- Postgres grants execute on a new function to PUBLIC. Take that back. The
-- anonymous role also lost usage on the schema in migration 0002, so this is
-- the second of two locks.
revoke all on function public.scout_madrid_iso(timestamptz)          from public;
revoke all on function public.scout_day_context(uuid)                from public;
revoke all on function public.scout_interview_context(uuid, text)    from public;
revoke all on function public.scout_summary_context(uuid)            from public;

do $$
begin
  grant execute on function public.scout_madrid_iso(timestamptz)       to service_role;
  grant execute on function public.scout_day_context(uuid)             to service_role;
  grant execute on function public.scout_interview_context(uuid, text) to service_role;
  grant execute on function public.scout_summary_context(uuid)         to service_role;
exception when undefined_object then
  raise notice 'No service_role role here, so the grants are skipped. That is right on a plain Postgres and wrong on Supabase.';
end $$;

-- PostgREST caches the list of callable functions. Supabase reloads it by
-- itself after a migration, but saying so costs nothing and saves a puzzled
-- "function not found" five minutes before a demo.
notify pgrst, 'reload schema';
