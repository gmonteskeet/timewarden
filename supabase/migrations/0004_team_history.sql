-- Workflow Scout: the team's approved history, and the two database calls
-- scenario seven makes.
--
-- Scenario seven reviews weeks of approved days and suggests workflows. Rolling
-- up hundreds of allocations and ranking the result inside make.com is slow and
-- fragile, so it follows the pattern of scenario four: one database call in,
-- which hands back the user message for the model already written, and one
-- database call out, which does every sum and writes the candidates.
--
-- The model scores each candidate. It never gives annual_cost_eur, total_score
-- or rank: scout_save_candidates works those out from the approved minutes and
-- each person's hourly cost, with the formula in AGENTS.md section 5.
--
-- Only approved check ins count, everywhere in this file.
--
-- Only the service key reaches any of this, exactly as in migration 0003.
-- Safe to run twice.

-- 1. The roll up, for any stretch of days ------------------------------------
-- One row per person and label. p_period_start and p_period_end may be null,
-- which means no bound on that side. The view below and both functions read
-- from this, so the three can never disagree about a number.
create or replace function public.scout_team_history(
  p_company_id   uuid,
  p_period_start date default null,
  p_period_end   date default null
)
returns table (
  person_id         uuid,
  company_id        uuid,
  full_name         text,
  label             text,
  in_role           boolean,
  topic_id          uuid,
  expected_percent  numeric,
  total_minutes     int,
  days_seen         int,
  monday_minutes    int,
  tuesday_minutes   int,
  wednesday_minutes int,
  thursday_minutes  int,
  friday_minutes    int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.company_id,
    p.full_name,
    da.label,
    da.in_role,
    da.topic_id,
    -- The role's expected share for that topic. Null outside the role.
    case when da.in_role then t.expected_percent end,
    sum(da.minutes)::int,
    count(distinct da.day)::int,
    coalesce(sum(da.minutes) filter (where extract(isodow from da.day) = 1), 0)::int,
    coalesce(sum(da.minutes) filter (where extract(isodow from da.day) = 2), 0)::int,
    coalesce(sum(da.minutes) filter (where extract(isodow from da.day) = 3), 0)::int,
    coalesce(sum(da.minutes) filter (where extract(isodow from da.day) = 4), 0)::int,
    coalesce(sum(da.minutes) filter (where extract(isodow from da.day) = 5), 0)::int
  from public.day_allocations da
  join public.check_ins ci on ci.id = da.check_in_id
  join public.people p     on p.id = da.person_id
  left join public.topics t on t.id = da.topic_id
  where ci.status = 'approved'
    and p.company_id = p_company_id
    and (p_period_start is null or da.day >= p_period_start)
    and (p_period_end   is null or da.day <= p_period_end)
  group by p.id, p.company_id, p.full_name, da.label, da.in_role, da.topic_id,
           case when da.in_role then t.expected_percent end;
$$;

comment on function public.scout_team_history(uuid, date, date) is
  'Approved minutes per person and label for one company, optionally between two dates. Read by the team_history view and by scenario seven.';

-- 2. The view -----------------------------------------------------------------
-- Every approved day the company has, with no period. Handy for checking the
-- numbers by hand in the SQL editor: select * from team_history.
-- security_invoker so the view does not lend its owner's rights to anyone.
create or replace view public.team_history
with (security_invoker = true)
as
select h.*
  from public.companies c
  cross join lateral public.scout_team_history(c.id, null, null) h;

comment on view public.team_history is
  'Approved minutes per person and label, all time. Scenario seven uses scout_suggest_context, which applies a period.';

-- 3. Scenario seven, the call in ----------------------------------------------
-- Gives back { ok, working_days_in_period, prompt_input }. prompt_input is the
-- whole user message for prompts/04_suggest_workflows.md, as JSON text, with
-- exactly the input names that prompt lists and no others.
create or replace function public.scout_suggest_context(
  p_company_id   uuid,
  p_period_start date,
  p_period_end   date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_working_days int;
  v_rows         int;
begin
  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    return jsonb_build_object('ok', false, 'message', 'There is no company with that id.');
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    return jsonb_build_object('ok', false, 'message', 'The period is not valid. It needs a start date on or before its end date.');
  end if;

  -- Monday to Friday. There are no bank holidays in the demo period.
  select count(*)::int into v_working_days
    from generate_series(p_period_start, p_period_end, interval '1 day') d
   where extract(isodow from d) between 1 and 5;

  select count(*)::int into v_rows
    from public.scout_team_history(p_company_id, p_period_start, p_period_end);

  if v_rows = 0 or v_working_days = 0 then
    return jsonb_build_object('ok', false, 'message', 'There are no approved days in that period to review.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'working_days_in_period', v_working_days,
    'prompt_input', (jsonb_build_object(
      'period_start',           to_char(p_period_start, 'YYYY-MM-DD'),
      'period_end',             to_char(p_period_end, 'YYYY-MM-DD'),
      'working_days_in_period', v_working_days,

      'team_history', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'person_name',      h.full_name,
                   'label',            h.label,
                   'in_role',          h.in_role,
                   'expected_percent', h.expected_percent,
                   'total_minutes',    h.total_minutes,
                   'days_seen',        h.days_seen,
                   'minutes_by_weekday', jsonb_build_object(
                     'monday',    h.monday_minutes,
                     'tuesday',   h.tuesday_minutes,
                     'wednesday', h.wednesday_minutes,
                     'thursday',  h.thursday_minutes,
                     'friday',    h.friday_minutes
                   ),
                   -- Up to three different evidence lines, most recent first.
                   'sample_evidence', coalesce((
                     select jsonb_agg(e.evidence order by e.last_day desc, e.evidence)
                       from (
                         select btrim(da.evidence) as evidence, max(da.day) as last_day
                           from public.day_allocations da
                           join public.check_ins ci on ci.id = da.check_in_id
                          where ci.status = 'approved'
                            and da.person_id = h.person_id
                            and da.label = h.label
                            and da.in_role = h.in_role
                            and da.topic_id is not distinct from h.topic_id
                            and da.day between p_period_start and p_period_end
                            and coalesce(btrim(da.evidence), '') <> ''
                          group by btrim(da.evidence)
                          order by max(da.day) desc, btrim(da.evidence)
                          limit 3
                       ) e
                   ), '[]'::jsonb)
                 )
                 order by h.full_name, h.in_role desc, h.total_minutes desc, h.label)
          from public.scout_team_history(p_company_id, p_period_start, p_period_end) h
      ), '[]'::jsonb),

      -- The people whose approved days are in the period, with their cost.
      'people', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'full_name',       p.full_name,
                   'role_title',      coalesce(r.title, ''),
                   'hourly_cost_eur', coalesce(p.hourly_cost_eur, 0)
                 )
                 order by p.full_name)
          from public.people p
          left join public.roles r on r.id = p.role_id
         where p.id in (
           select h.person_id
             from public.scout_team_history(p_company_id, p_period_start, p_period_end) h
         )
      ), '[]'::jsonb),

      -- The roles those people hold, with each role's topics.
      'roles_and_topics', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'role_title', r.title,
                   'topics', coalesce((
                     select jsonb_agg(
                              jsonb_build_object(
                                'name',             t.name,
                                'expected_percent', t.expected_percent
                              )
                              order by t.sort_order, t.name)
                       from public.topics t
                      where t.role_id = r.id
                   ), '[]'::jsonb)
                 )
                 order by r.title)
          from public.roles r
         where r.id in (
           select p.role_id
             from public.people p
            where p.id in (
              select h.person_id
                from public.scout_team_history(p_company_id, p_period_start, p_period_end) h
            )
         )
      ), '[]'::jsonb)
    ))::text
  );
end;
$$;

comment on function public.scout_suggest_context(uuid, date, date) is
  'Scenario seven: the approved history for a period, and the ready made user message for prompts/04_suggest_workflows.md.';

-- 4. Scenario seven, the call out ---------------------------------------------
-- Takes the model's candidates, either the array itself or the whole reply
-- { "candidates": [...] }. Replaces the company's earlier proposed candidates.
-- Candidates already approved, rejected or drafted are left alone.
--
-- For each candidate, from the approved minutes on its source_label:
--   people_affected  how many people have minutes on that label
--   hours_per_week   the team's total, to one decimal place
--   annual_cost_eur  sum over those people of (their hours per week * 46 *
--                    their hourly cost), to the nearest euro
--   total_score      0.35 * time + 0.20 * repetitive + 0.15 * reliability
--                    + 0.30 * role distance
--   rank             1 for the highest total_score
-- The model's own people_affected and hours_per_week are only kept when its
-- source_label matches nothing in the history, and then annual_cost_eur is 0.
create or replace function public.scout_save_candidates(
  p_company_id   uuid,
  p_period_start date,
  p_period_end   date,
  p_candidates   jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_list         jsonb;
  v_working_days int;
  v_weeks        numeric;
  v_created      int;
  v_titles       jsonb;
begin
  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    return jsonb_build_object('ok', false, 'message', 'There is no company with that id.');
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    return jsonb_build_object('ok', false, 'message', 'The period is not valid. It needs a start date on or before its end date.');
  end if;

  v_list := case
    when jsonb_typeof(p_candidates) = 'array' then p_candidates
    when jsonb_typeof(p_candidates) = 'object'
     and jsonb_typeof(p_candidates -> 'candidates') = 'array' then p_candidates -> 'candidates'
    else null
  end;

  if v_list is null then
    return jsonb_build_object('ok', false, 'message', 'The suggestions were not in the expected shape.');
  end if;

  select count(*)::int into v_working_days
    from generate_series(p_period_start, p_period_end, interval '1 day') d
   where extract(isodow from d) between 1 and 5;
  v_weeks := greatest(v_working_days, 1)::numeric / 5;

  delete from public.candidates
   where company_id = p_company_id
     and status = 'proposed';

  with incoming as (
    select c.value as cand, c.ordinality as n
      from jsonb_array_elements(v_list) with ordinality c
     where jsonb_typeof(c.value) = 'object'
       and coalesce(btrim(c.value ->> 'title'), '') <> ''
  ),
  -- Each person's minutes on each label in the period. The label is matched
  -- without regard to case or spaces at the ends, so "Manual Status Reporting"
  -- still finds "Manual status reporting".
  per_person as (
    select lower(btrim(h.label)) as label_key,
           h.person_id,
           sum(h.total_minutes) as minutes
      from public.scout_team_history(p_company_id, p_period_start, p_period_end) h
     group by lower(btrim(h.label)), h.person_id
  ),
  costed as (
    select i.n,
           i.cand,
           count(pp.person_id)::int as people_affected,
           coalesce(sum(pp.minutes), 0) as team_minutes,
           coalesce(sum(pp.minutes / 60.0 / v_weeks * 46 * coalesce(p.hourly_cost_eur, 0)), 0) as annual
      from incoming i
      left join per_person pp on pp.label_key = lower(btrim(i.cand ->> 'source_label'))
      left join public.people p on p.id = pp.person_id
     group by i.n, i.cand
  ),
  scored as (
    select c.*,
           -- Whole numbers from 1 to 5, whatever the model sent.
           greatest(1, least(5, round(coalesce((c.cand ->> 'score_time')::numeric, 1))))::int          as s_time,
           greatest(1, least(5, round(coalesce((c.cand ->> 'score_repetitive')::numeric, 1))))::int    as s_rep,
           greatest(1, least(5, round(coalesce((c.cand ->> 'score_reliability')::numeric, 1))))::int   as s_rel,
           greatest(1, least(5, round(coalesce((c.cand ->> 'score_role_distance')::numeric, 1))))::int as s_dist
      from costed c
  ),
  totalled as (
    select s.*,
           round(0.35 * s.s_time + 0.20 * s.s_rep + 0.15 * s.s_rel + 0.30 * s.s_dist, 2) as total
      from scored s
  ),
  ranked as (
    select t.*,
           row_number() over (order by t.total desc, t.annual desc, t.n)::int as rnk
      from totalled t
  ),
  inserted as (
    insert into public.candidates (
      company_id, title, description, source_label, people_affected,
      hours_per_week, annual_cost_eur, period_start, period_end,
      score_time, score_repetitive, score_reliability, score_role_distance,
      total_score, rank, reasoning, proposed_steps, status
    )
    select
      p_company_id,
      btrim(r.cand ->> 'title'),
      r.cand ->> 'description',
      r.cand ->> 'source_label',
      case when r.people_affected > 0 then r.people_affected
           else nullif(r.cand ->> 'people_affected', '')::numeric::int end,
      case when r.people_affected > 0 then round(r.team_minutes / 60.0 / v_weeks, 1)
           else nullif(r.cand ->> 'hours_per_week', '')::numeric end,
      round(r.annual),
      p_period_start,
      p_period_end,
      r.s_time, r.s_rep, r.s_rel, r.s_dist,
      r.total,
      r.rnk,
      r.cand ->> 'reasoning',
      case when jsonb_typeof(r.cand -> 'proposed_steps') = 'array'
           then r.cand -> 'proposed_steps' else '[]'::jsonb end,
      'proposed'
    from ranked r
    returning title, rank
  )
  select count(*)::int,
         coalesce(jsonb_agg(title order by rank), '[]'::jsonb)
    into v_created, v_titles
    from inserted;

  return jsonb_build_object(
    'ok', true,
    'candidates_created', v_created,
    'titles_in_rank_order', v_titles
  );
end;
$$;

comment on function public.scout_save_candidates(uuid, date, date, jsonb) is
  'Scenario seven: replace the proposed candidates, working out cost, score and rank from the approved history.';

-- 5. Only the service key may reach these -------------------------------------
revoke all on function public.scout_team_history(uuid, date, date)             from public;
revoke all on function public.scout_suggest_context(uuid, date, date)          from public;
revoke all on function public.scout_save_candidates(uuid, date, date, jsonb)   from public;
revoke all on public.team_history from public;

do $$
begin
  revoke all on public.team_history from anon, authenticated;
exception when undefined_object then
  raise notice 'No anon or authenticated role here, so there is nothing to take back.';
end $$;

do $$
begin
  grant execute on function public.scout_team_history(uuid, date, date)           to service_role;
  grant execute on function public.scout_suggest_context(uuid, date, date)        to service_role;
  grant execute on function public.scout_save_candidates(uuid, date, date, jsonb) to service_role;
  grant select on public.team_history to service_role;
exception when undefined_object then
  raise notice 'No service_role role here, so the grants are skipped. That is right on a plain Postgres and wrong on Supabase.';
end $$;

notify pgrst, 'reload schema';
