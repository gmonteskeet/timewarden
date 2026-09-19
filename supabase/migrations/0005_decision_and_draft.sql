-- Workflow Scout: the two database calls scenario eight makes.
--
-- A manager approves or rejects one suggestion. On approval, scenario eight
-- asks Claude to fill the draft template, creates the draft scenario in
-- make.com and records where it is. Following scenarios four and seven: one
-- database call in, which checks the request, records the decision and hands
-- back the user message for the model already written, and one call out,
-- which records the draft.
--
-- A candidate that already has a draft is never drafted twice: the call in
-- returns the existing link instead, so a double click cannot create two
-- scenarios in make.com.
--
-- Independent of migration 0004. It only needs the candidates, approvals and
-- people tables from migrations 0001 and 0002.
--
-- Only the service key reaches these, exactly as in migration 0003.
-- Safe to run twice.

-- 1. Scenario eight, the call in ---------------------------------------------
-- Rejected: { ok, decision }.
-- Approved: { ok, decision, needs_draft, candidate_title, prompt_input }, where
-- prompt_input is the whole user message for prompts/05_draft_workflow_fill.md
-- as JSON text, with exactly the input names that prompt lists.
-- Already drafted: { ok, decision, already_drafted, make_scenario_url }, and
-- nothing is written.
create or replace function public.scout_decision_context(
  p_candidate_id uuid,
  p_approver_id  uuid,
  p_decision     text,
  p_comment      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_cand     public.candidates%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_comment  text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'message', 'The decision must be approved or rejected.');
  end if;

  -- Locked for the rest of this call, so two calls for the same candidate
  -- take turns rather than both writing an approval at once.
  select * into v_cand
    from public.candidates c
   where c.id = p_candidate_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'There is no suggestion with that id.');
  end if;

  if not exists (
    select 1
      from public.people p
     where p.id = p_approver_id
       and p.app_role = 'manager'
       and p.company_id = v_cand.company_id
  ) then
    return jsonb_build_object('ok', false, 'message', 'Only a manager in the same company can decide on this suggestion.');
  end if;

  -- A draft already exists. Hand back its link and change nothing.
  if v_cand.status = 'drafted' then
    return jsonb_build_object(
      'ok',                true,
      'decision',          v_decision,
      'already_drafted',   true,
      'needs_draft',       false,
      'make_scenario_url', v_cand.make_scenario_url
    );
  end if;

  insert into public.approvals (candidate_id, approver_id, decision, comment)
  values (v_cand.id, p_approver_id, v_decision, v_comment);

  if v_decision = 'rejected' then
    update public.candidates set status = 'rejected' where id = v_cand.id;
    return jsonb_build_object(
      'ok',              true,
      'decision',        'rejected',
      'already_drafted', false,
      'needs_draft',     false
    );
  end if;

  update public.candidates set status = 'approved' where id = v_cand.id;

  return jsonb_build_object(
    'ok',              true,
    'decision',        'approved',
    'already_drafted', false,
    'needs_draft',     true,
    'candidate_title', v_cand.title,
    'prompt_input', (jsonb_build_object(
      'candidate', jsonb_build_object(
        'title',           v_cand.title,
        'description',     coalesce(v_cand.description, ''),
        'source_label',    coalesce(v_cand.source_label, ''),
        'people_affected', v_cand.people_affected,
        'hours_per_week',  v_cand.hours_per_week,
        'reasoning',       coalesce(v_cand.reasoning, ''),
        'proposed_steps',  coalesce(v_cand.proposed_steps, '[]'::jsonb)
      ),
      -- The template scenario "TEMPLATE: Weekly client status report", in
      -- plain words. Keep in step with make/blueprints/template_weekly_status_report.tpl.json.
      'template_description',
        'Weekly schedule. Google Sheets Search rows reads every row of one sheet. '
        || 'Anthropic Claude Create a message writes a summary of those rows following summary_prompt. '
        || 'Gmail Create a draft puts the summary in a draft email to recipients. '
        || 'The scenario is created switched off.',
      -- Everyone with approved minutes on the suggestion's label, inside its
      -- period when it has one.
      'contacts', coalesce((
        select jsonb_agg(
                 jsonb_build_object('full_name', p.full_name, 'email', coalesce(p.email, ''))
                 order by p.full_name)
          from public.people p
         where p.company_id = v_cand.company_id
           and p.id in (
             select da.person_id
               from public.day_allocations da
               join public.check_ins ci on ci.id = da.check_in_id
              where ci.status = 'approved'
                and lower(btrim(da.label)) = lower(btrim(coalesce(v_cand.source_label, '')))
                and (v_cand.period_start is null or da.day >= v_cand.period_start)
                and (v_cand.period_end   is null or da.day <= v_cand.period_end)
           )
      ), '[]'::jsonb)
    ))::text
  );
end;
$$;

comment on function public.scout_decision_context(uuid, uuid, text, text) is
  'Scenario eight: check and record a manager''s decision on a suggestion, and on approval return the ready made user message for prompts/05_draft_workflow_fill.md.';

-- 2. Scenario eight, the call out --------------------------------------------
create or replace function public.scout_save_draft(
  p_candidate_id      uuid,
  p_make_scenario_id  text,
  p_make_scenario_url text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(btrim(p_make_scenario_id), '') = '' or coalesce(btrim(p_make_scenario_url), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'The draft scenario id and address are both needed.');
  end if;

  update public.candidates
     set status            = 'drafted',
         make_scenario_id  = btrim(p_make_scenario_id),
         make_scenario_url = btrim(p_make_scenario_url)
   where id = p_candidate_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'There is no suggestion with that id.');
  end if;

  return jsonb_build_object('ok', true, 'make_scenario_url', btrim(p_make_scenario_url));
end;
$$;

comment on function public.scout_save_draft(uuid, text, text) is
  'Scenario eight: record the draft scenario made for an approved suggestion.';

-- 3. Only the service key may call these -------------------------------------
revoke all on function public.scout_decision_context(uuid, uuid, text, text) from public;
revoke all on function public.scout_save_draft(uuid, text, text)             from public;

do $$
begin
  grant execute on function public.scout_decision_context(uuid, uuid, text, text) to service_role;
  grant execute on function public.scout_save_draft(uuid, text, text)             to service_role;
exception when undefined_object then
  raise notice 'No service_role role here, so the grants are skipped. That is right on a plain Postgres and wrong on Supabase.';
end $$;

notify pgrst, 'reload schema';
