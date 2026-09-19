# BUILD_GERSON.md: repository, database, make.com agent, deployment

You are the coding agent working for Gerson on the Workflow Scout hackathon build. Gerson is the technical owner and has the final say on technical choices. If he overrules something in this file, follow him and note the change in `docs/decisions.md`.

**Before anything else:** read `AGENTS.md` at the repository root. Its rules and data contract override anything here. Work through the tasks in order. One task, one branch, one pull request. After each task, run its checks, tick it here, and report in three lines.

You own: `supabase/`, `make/`, `scripts/`, deployment, `README.md`. Do not edit `frontend/` (except in task G1), `data/` or `prompts/`.

Important: make.com scenarios are built in the make.com editor, not in code. Your job for those tasks is to produce an exact build sheet per scenario in `make/specs/` (modules in order, every field mapping, the HTTP bodies, the JSON parsing), so Gerson can click it together quickly, and then to save the exported blueprint in `make/blueprints/`. If Gerson connects the make.com MCP server or gives you a make.com API token, you may create the scenarios through the API instead, but ask him first.

make.com apps confirmed available in the account: `anthropic-claude` (version 1), `google-calendar` (version 5), `supabase` (version 1), `http` (version 4), `make` (version 1, for calling the make.com API), plus Webhooks and JSON tools.

Time boxes are Madrid time, Saturday 19 September unless stated.

---

## Phase 0: set up (finish by 15:30)

### G1. Repository skeleton (20 minutes)
- The repository already exists: `github.com/gmonteskeet/timewarden`, Marcus is a collaborator, and the planning documents and empty folders are already in it. Confirm it is public. Protect `main` lightly: pull requests required, no review required (speed matters).
- Folders: `frontend/`, `supabase/migrations/`, `make/specs/`, `make/blueprints/`, `scripts/`, `data/`, `prompts/`, `docs/`.
- `frontend/`: `npx create-next-app@latest frontend --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"`. Add `@supabase/supabase-js`. Confirm `npm run lint && npm run build` pass. After this, `frontend/` belongs to Marcus.
- Root files already present: `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.env.example`, and both build files in `docs/`. Check the `.gitignore` (must include `.env*`, `!.env.example`, `node_modules`, `.next`, `.vercel`), `.env.example` with the names from `AGENTS.md` section 7 and empty values, `docs/BUILD_MARCUS.md`, `docs/BUILD_GERSON.md`.
- Checks: fresh clone, `cd frontend && npm install && npm run build` passes. Tell Marcus the repository is ready.

### G2. Supabase project and schema (25 minutes) [done]
- Gerson creates the Supabase project by hand and gives you the URL and keys through `.env.local` only.
- Write `supabase/migrations/0001_init.sql` creating every table in `AGENTS.md` section 5, exactly those names and columns, with foreign keys, `check` constraints for every listed text value set, and indexes on `person_id` and `week_start`.
- Row level security on for all tables, one policy per table allowing `select` to `anon`. No insert, update or delete policies (the service key bypasses row level security).
- Write `supabase/reset.sql` that empties the run time tables (`activities` where source is `voice`, `voice_notes`, `interview_questions`, `findings`, `candidates`, `approvals`) but keeps people, calendar and transcript data. This is the "clean start" for demo rehearsals.
- Checks: migration runs clean on the empty project. Anonymous read works, anonymous insert is refused.

### G3. Secrets and connections (10 minutes, Gerson by hand)
Build sheet `make/specs/00_connections.md` listing what Gerson must create in make.com: Anthropic Claude connection (Marcus's key), Google Calendar connection (the Google account that holds the "Scout demo: Elena Ruiz" calendar), Supabase connection (service key), a make.com API token with scopes to create scenarios, and one shared secret value for `SCOUT_SHARED_SECRET`. He sends Marcus the public Supabase URL and anon key, and later the four webhook addresses, by direct message.

---

## Phase 1: thin path (finish by 18:30)

### G4. Seed script (25 minutes)
Branch `gerson/g4-seed`. `scripts/seed.mjs` (Node, uses `@supabase/supabase-js` and the service key from the environment). Reads `data/company.json`, `data/people.json` (links `manager_key`), `data/transcripts/*.txt` (header block then body) into `transcripts`, and optionally `data/team_findings.json` if present. Idempotent: running twice does not duplicate (upsert on a natural key). It does NOT load the calendar; that comes live from Google Calendar through make.com. Print the person ids at the end, and write them to `docs/demo_ids.md` so Marcus can use them.
Checks: run twice, row counts unchanged on the second run.

### General pattern for every make.com scenario
State this once at the top of `make/specs/README.md`:
- Trigger: Custom webhook. First module after it: a filter that stops unless header `x-scout-key` equals the shared secret.
- Claude calls: `anthropic-claude` "Create a message" module, model `claude-sonnet-4-5`, max tokens 4000, temperature 0.2, system prompt pasted from the named file in `prompts/`, user message is a JSON string of the inputs. Follow with "Parse JSON". Add an error handler route: on parse failure, retry the Claude call once with the extra line "Return valid JSON only, no commentary", then give up and write the error to a `make_errors` data store.
- Database: `supabase` app modules where they exist (select rows, insert row, update row). Use the `http` app against the Supabase REST address for bulk inserts.
- Last module: Webhook response, status 200, JSON body as in `AGENTS.md` section 6.
- Naming: `Scout 1: Calendar intake`, `Scout 2: Transcript intake`, and so on. Put all in one folder called `Workflow Scout`.
- After building each, export the blueprint to `make/blueprints/<same name>.json`. Check the export contains no keys.

### G5. Scenario "Scout 1: Calendar intake" (30 minutes)
Spec file `make/specs/01_calendar_intake.md`. Input `{ person_id, week_start }`. Steps: get the person's `calendar_id` from Supabase; Google Calendar "Search events" from `week_start` 00:00 to `week_start` plus 5 days, Europe/Madrid; delete existing `activities` for that person, week and source `calendar`; insert one activity per event with `title`, `description`, `starts_at`, `ends_at`, `minutes`, `attendees`. Output `{ ok, inserted }`. This is a sub scenario: called by the main agent, and also runnable on a schedule (daily 07:00) to show "continuous capture".

### G6. Scenario "Scout 2: Transcript intake" (20 minutes, first item to cut)
Spec `make/specs/02_transcript_intake.md`. Input `{ person_id, week_start }`. Reads `transcripts` rows for the week. For each, one Claude call (short inline prompt: "Summarise in two sentences what work was actually being done in this call and name the activity") and insert an activity with source `transcript`, `description` set to the summary. Rows with `in_calendar` false are what prove unplanned work.

### G7. Scenario "Scout 3: Voice intake and interview" (45 minutes)
Spec `make/specs/03_voice_and_interview.md`. Webhook `MAKE_WEBHOOK_VOICE`. Steps:
1. Insert `voice_notes` row.
2. Call Scout 1 and Scout 2 as sub scenarios (the `make` app "Run a scenario" module, wait for completion) so the seen data is fresh.
3. Claude with `prompts/01_extract_said_activities.md`; insert activities with source `voice`.
4. Select all activities for the person and week.
5. Claude with `prompts/02_interview_questions.md`; insert `interview_questions`.
6. Respond `{ ok, voice_note_id, questions_created }`.
Keep total run time under 40 seconds. If it is over, respond straight after step 1 and let the rest run on; Marcus's screen polls for the questions.

### G8. Scenario "Scout 4: Answers, findings and scoring" (45 minutes)
Spec `make/specs/04_answers_and_scoring.md`. Webhook `MAKE_WEBHOOK_ANSWER`. Update the question with the answer. Count unanswered questions for that person and week. If more than zero, respond `{ ok, remaining }`. If zero: Claude with `prompts/03_categorise_and_find.md`, insert `findings` (verdicts `pending`), update `activities.category`; Claude with `prompts/04_score_candidates.md`; compute `total_score` with the formula in `AGENTS.md` in make.com itself (do not trust the model's arithmetic); sort and set `rank`; insert `candidates` with status `proposed`.

### G9. Scenario "Scout 5: Verdicts" (10 minutes)
Webhook `MAKE_WEBHOOK_VERDICT`. Updates the employee or manager verdict fields on a finding. Simple on purpose.

### G10. The agent: "Scout Agent" (30 minutes)
The brief asks for "a sophisticated technical agent, sub-scenarios and human approval in the background". Build a make.com AI Agent called `Workflow Scout` with this system prompt: it is an automation scout inside a company; its goal is to keep each person's picture of their week current and to surface automation candidates; it has tools and decides which to call. Register as tools: Scout 1, Scout 2, Scout 4 (scoring path) and Scout 6 (draft creation, which it may only call after an approval exists). Add one scheduled scenario `Scout 0: Daily run` (07:00) that asks the agent: "For each person in the company, refresh this week's calendar and transcripts, and tell me who has not checked in."
If the AI Agents feature is not on the account's plan, fall back to a plain main scenario that calls the sub scenarios in order with "Run a scenario", and record this in `docs/decisions.md`.

### Checkpoint one, 18:30
With Marcus: voice note in, questions out, answers in, findings and ranked candidates out. Ugly is fine. Nothing new starts until this runs.

---

## Phase 2: the ending (18:30 to 22:30)

### G11. The draft workflow template (45 minutes)
This is the ending of the demo, so make it reliable rather than clever.
1. Gerson builds by hand, in make.com, one template scenario `TEMPLATE: Weekly client status report`: schedule trigger (weekly), Google Sheets "Search rows" (project tracker), Anthropic Claude "Create a message" (write the status summary), Gmail "Create a draft" (to the client list). Leave connections unset where needed; it only has to open cleanly as a draft.
2. Export its blueprint to `make/blueprints/template_weekly_status_report.json`.
3. You turn that into `make/blueprints/template_weekly_status_report.tpl.json` with placeholders `{{scenario_name}}`, `{{source_sheet_name}}`, `{{recipients}}`, `{{summary_prompt}}`, and write the matching `scheduling` object for `{{schedule}}`.

### G12. Scenario "Scout 6: Approval and draft creation" (60 minutes)
Spec `make/specs/06_approval_and_draft.md`. Webhook `MAKE_WEBHOOK_DECISION`. This is the human approval step.
1. Insert `approvals` row. If rejected: set candidate status `rejected`, respond.
2. If approved: set status `approved`. Claude with `prompts/05_draft_workflow_fill.md` to get the fill values.
3. Replace the placeholders in the template blueprint (keep the template text in a make.com data store or a Set variable module).
4. Call the make.com API: `POST /api/v2/scenarios` on the account's zone address, header `Authorization: Token <token>`, body `{ "teamId": <id>, "blueprint": "<blueprint as a JSON string>", "scheduling": "<scheduling as a JSON string>", "folderId": <Workflow Scout drafts folder> }`. The scenario is created switched off, which is what we want: a draft for a human to finish.
5. Build the scenario address from the returned id, update the candidate: status `drafted`, `make_scenario_id`, `make_scenario_url`.
6. Respond `{ ok, make_scenario_url }`.
For candidates that do not match the template, do not attempt to generate a blueprint from nothing. Create a draft from the template anyway with the candidate's name, and put the candidate's `proposed_steps` in the scenario's notes. Be honest about this in the README.
Checks: approve from Marcus's screen, the link opens a real draft scenario in the account. Run it three times; delete the test drafts afterwards.

### G13. Deploy (20 minutes)
Vercel project pointing at `frontend/`. Set every environment variable from `AGENTS.md` section 7. Confirm the four server routes reach make.com from the deployed site. Give Marcus the address.

### G14. Load team data (10 minutes)
When Marcus delivers `data/team_findings.json`, run the seed again.

### Checkpoint two, 22:30
Feature freeze with Marcus. Write Sunday's list in `docs/sunday.md` before leaving.

---

## Phase 3 and 4: Sunday 20 September

### G15. Two clean runs (09:00 to 09:40)
Run `supabase/reset.sql`, then the whole story, twice. Fix only what breaks the story.

### G16. Quality Clouds scanner (09:40 to 10:15)
Install and run Norma (`github.com/qualityclouds/norma-mcp`, or norma.qualityclouds.com). Fix at least one real issue. Give Marcus the list of what was fixed and what was left, with file names, for `DEFENCE.md`.

### G17. Secrets sweep and blueprints (10:15 to 10:30)
Search the repository and every exported blueprint for keys, tokens and webhook addresses. Webhook addresses count as secrets. Code freeze at 10:30.

### G18. README (10:30 to 11:15)
`README.md`: what it is in three sentences; the demo story; a diagram of the agent and its sub scenarios (Mermaid); "Where make.com powers it" as a plain list; how to run it (Supabase migration, seed, import blueprints, environment variables, `npm run dev`); honest limits (made up data, public read policy, one draft template, browser speech recognition); roadmap. British spelling, no em dashes.

### G19. Demo duty (11:15 onwards)
Gerson drives the demo while Marcus presents. Keep make.com and Vercel running until 18:00. Before each judging round: run `supabase/reset.sql` and delete old draft scenarios.

---

## If something goes wrong
- Claude returns broken JSON: the retry route in the general pattern handles it. If it persists, lower the amount of input (send activity titles and minutes only).
- Scenario run time too long for the webhook reply: reply early and let Marcus's screen poll the database.
- make.com API refuses the blueprint: create the draft with the untouched template blueprint and only change the name. A real draft that opens beats a clever one that fails.
- Google Calendar connection trouble for more than 20 minutes: load `data/calendar_week.json` with the seed script instead, tell Marcus, and note in the README that the live calendar connection is the intended design.
