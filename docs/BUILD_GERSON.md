# BUILD_GERSON.md: database, make.com agent, deployment (version 2)

You are the coding agent working for Gerson on the Workflow Scout hackathon build. Gerson is the technical owner and has the final say on technical choices. If he overrules something here, follow him and record it in `docs/decisions.md`.

**Before anything else:** read `AGENTS.md` (version 2) and `docs/CHANGES_V2.md`. They override anything from version 1. Work through the tasks in order. One task, one branch, one pull request. After each task, run its checks, tick it here and report in three lines.

You own: `supabase/`, `make/`, `scripts/`, deployment, `README.md`, `docs/decisions.md`. Do not edit `frontend/`, `data/` or `prompts/`.

Done already and still valid: task G1 (repository skeleton), task G2 (schema, migration `0001`), task G3 (connections build sheet and the shared make.com pattern in `make/specs/README.md`). The decisions in `docs/decisions.md` stand.

make.com scenarios are built in the make.com editor. For those tasks you write an exact build sheet in `make/specs/` (modules in order, every field mapping, HTTP bodies, JSON structures), Gerson builds it, and you save the exported blueprint to `make/blueprints/` after checking it holds no keys, tokens or webhook addresses. If Gerson connects the make.com MCP server or gives you an API token, you may build scenarios through the API, but ask him first.

Times are Madrid time, Saturday 19 September unless stated.

---

## Phase 1: to checkpoint one at 20:00

### G4. Migration to the version 2 schema (30 minutes, 17:15 to 17:45) [done]
Branch `gerson/g4-schema-v2`. Write `supabase/migrations/0002_version_2.sql` that takes the database from migration `0001` to the tables in `AGENTS.md` section 5:
- Create `roles`, `topics`, `check_ins`, `interview_turns`, `day_allocations`.
- `people`: add `role_id`, `email`, `app_role`, `access_token` (unique, default `encode(gen_random_bytes(24), 'hex')`), `working_minutes_per_day`. Drop `role_title`, `job_description`, `performance_criteria`.
- `activities`: add `day`, drop `week_start` and `category`, change the allowed `source` values to `calendar`, `transcript`, `interview`.
- `candidates`: drop `person_id`, add `source_label`, `people_affected`, `period_start`, `period_end`.
- Drop `voice_notes`, `interview_questions`, `findings`.
- Drop every "public read" policy and revoke `select` from the anonymous role. Row level security stays on with no policies, so only the service key can read or write.
- Check constraints for every listed text value set. Unique keys the seed script needs: `roles(company_id, title)`, `topics(role_id, name)`, `check_ins(person_id, day)`. Indexes on `person_id` and `day`.
- A check, by trigger or in the seed and scenarios, that a role's `expected_percent` values add up to 100. A deferred constraint trigger is best if quick, otherwise enforce it in the scenario and record that in `docs/decisions.md`.
Rewrite `supabase/reset.sql`: it returns the database to "the morning of the demo". It deletes Elena's check in for 18 September with its turns, allocations and interview activities, deletes all candidates and approvals, sets every role's `split_status` back to `proposed` with `expected_percent` equal to `proposed_percent`. It keeps people, roles, topics, calendar and transcript activities and the three weeks of history.
Checks: both migrations run clean in order on an empty database. With the anonymous key, a select returns nothing or is refused.

### G5. Connections and the scenario map (15 minutes)
Branch `gerson/g5-connections-v2`. Update `make/specs/00_connections.md`: add Google Drive (the account holding the "Brightline Advisory role documents" folder), Gmail or the make.com Email app for the morning email, and keep Claude, Google Calendar, Supabase and the make.com API token. Add a short section "Swapping Google Drive for SharePoint": which module changes (the first two of scenario one) and nothing else. Replace the scenario table in `make/specs/README.md` with:

| Sheet | Scenario | Trigger |
|---|---|---|
| `01_role_documents_and_splits.md` | `Scout 1: Role documents and expected splits` | `MAKE_WEBHOOK_ROLES_SYNC`, and weekly |
| `02_split_approval.md` | `Scout 2: Split approval` | `MAKE_WEBHOOK_SPLIT_APPROVAL` |
| `03_morning_run.md` | `Scout 3: Morning run` | weekdays 07:30, and `MAKE_WEBHOOK_MORNING_RUN` |
| `03a_calendar_intake.md` | `Scout 3a: Calendar intake` | called by scenario three |
| `03b_transcript_intake.md` | `Scout 3b: Transcript intake` | called by scenario three |
| `04_interview_turn.md` | `Scout 4: Interview turn` | `MAKE_WEBHOOK_INTERVIEW` |
| `05_day_summary.md` | `Scout 5: Day summary` | called by scenario four |
| `06_submit_and_day_approval.md` | `Scout 6: Submit and day approval` | `MAKE_WEBHOOK_SUBMIT`, `MAKE_WEBHOOK_DAY_APPROVAL` |
| `07_suggest_workflows.md` | `Scout 7: Suggest workflows` | `MAKE_WEBHOOK_SUGGEST`, and weekly |
| `08_decision_and_draft.md` | `Scout 8: Decision and draft creation` | `MAKE_WEBHOOK_DECISION` |

### G6. Seed script (30 minutes)
Branch `gerson/g6-seed`. `scripts/seed.mjs` (Node, `@supabase/supabase-js`, service key from the environment). Idempotent upserts. Loads: `data/company.json`; roles from `data/role_documents/*.md` (title from the first heading, body into `job_description`, the performance measures list into `kpis`); `data/people.json` (link `role_key` and `manager_key`); `data/transcripts/*.txt`; `data/history.json` (check ins with status `approved`, approved by Tomas, plus their `day_allocations`, linking `person_key` and `topic_name`).
Flags: `--with-splits` also loads `data/expected_splits.json` into `topics` as `proposed`, for use only if reading the document store live is cut. `--with-calendar` loads `data/calendar_week.json` into `activities`, for use only if the Google Calendar connection fails. Without flags, topics and calendar activities come from make.com.
At the end write `docs/demo_links.md`, **which must be in `.gitignore`**, listing each person's id and their `/enter/<access_token>` link for Marcus. Tokens are secrets.
Checks: run twice, row counts unchanged. `git status` shows `docs/demo_links.md` ignored.

### G7. Scenario 4: Interview turn, and scenario 5: Day summary (60 minutes). Build these first of all scenarios. They are the heart of the demo.
Branch `gerson/g7-interview`. Needs `prompts/02_interview_turn.md` and `prompts/03_day_summary.md` from Marcus's task M4. If they are not merged yet, build against the input and output shapes in `docs/BUILD_MARCUS.md` task M4 and paste the prompts in when they land.
`make/specs/04_interview_turn.md`. Webhook `MAKE_WEBHOOK_INTERVIEW`, body `{ check_in_id, employee_text }`.
1. Shared secret filter.
2. Select the check in, the person, their role and approved topics, the day's `activities`, and all `interview_turns` so far in `turn_no` order.
3. If `employee_text` is not null: insert it as the next turn, speaker `employee`. If the check in status is `invited`, set it to `in_progress`.
4. If six scout questions have already been asked, skip Claude and go to step 6 with a fixed closing line.
5. Claude with `prompts/02_interview_turn.md`. Parse JSON with the retry route from the shared pattern.
6. Insert the scout turn (`question`, `kind`, `evidence`).
7. If `done`: start scenario five with `{ check_in_id }` **without waiting for it**.
8. Webhook response `{ ok, done, turn_no, question, kind, evidence }`.
Speed matters: the whole run must finish within 12 seconds. Use one HTTP call to a Supabase view or RPC to fetch the context in one go if separate selects are too slow. Max tokens 600 for this call.
`make/specs/05_day_summary.md`. Input `{ check_in_id }`. Gather the same context plus the full interview and the distinct outside role labels already used in this company's `day_allocations` (pass as `known_outside_labels`). Claude with `prompts/03_day_summary.md`. In make.com, not in the model: check minutes add up to the working day, and if they are off by a small amount adjust the largest row, then compute each `percent`. Map `topic_name` to `topic_id`. Replace the check in's `day_allocations`, write `summary_text`, insert one `activities` row per allocation with source `interview`, set status `summarised`.
Checks: using Elena's Friday and the answers in `data/interview_script.md`, the interview asks about the 09:00 to 11:00 gap and the "Friday report send out", finishes in six questions or fewer, and the summary shows "Manual status reporting" as outside the role at about 150 minutes or more.

### G8. Scenario 3: Morning run, with 3a calendar intake and 3b transcript intake (45 minutes)
Branch `gerson/g8-morning-run`. Input `{ company_id, day }`. When run on the schedule, `day` is the previous working day.
- 3a: for one person and day, Google Calendar "Search events" for that day (Europe/Madrid), replace that day's `calendar` activities. People without a `calendar_id` are skipped.
- 3b (second thing to cut): for one person and day, read `transcripts` for that day, one short Claude call each ("In two sentences, what work was being done in this call?"), replace that day's `transcript` activities. `in_calendar` false is what reveals unplanned work.
- Scenario three: for each person with `app_role` `employee`: run 3a and 3b, upsert a `check_ins` row with status `invited` (never overwrite one that has moved past `invited`), then send the email. Subject: "Tell Scout about your last working day". Body, plain and short: a greeting by first name, one sentence saying what Scout already knows ("I have your calendar and 1 recorded call for Friday 18 September"), one sentence on privacy (rule 12 in `AGENTS.md`), and the link `<APP_URL>/enter/<access_token>?next=/check-in/<check_in_id>`. British spelling, no em dashes.
- Reply `{ ok, check_ins_created, emails_sent }`.
For the demo, Elena's `email` in the live database is an inbox Marcus can open on stage. The other two can point at Gerson's.

### Checkpoint one, 20:00
With Marcus: one real interview turn goes from his interface to make.com and back. Agree what gets cut, if anything.

---

## Phase 2: 20:00 to 22:30

### G9. Scenario 1: Role documents and expected splits, and scenario 2: Split approval (45 minutes)
Branch `gerson/g9-roles`.
Scenario one: Google Drive "Search for files" in the role documents folder, "Download a file" with conversion to plain text for each, upsert into `roles` (`document_name`, `document_url`, `job_description`, `source_read_at`). For each role: Claude with `prompts/01_propose_role_split.md`, check in make.com that the percents add up to 100 (adjust the largest if not), and replace the role's topics **only if the role's `split_status` is not `approved`**, setting `proposed_percent` and `expected_percent` to the same value. Never overwrite an approved split: if the document changed, a later version can flag it, not now.
Scenario two: check the numbers add up to 100, update each topic's `expected_percent`, set the role to `approved` with who and when. This is the first human approval the judges see.
Fallback (fourth in the cut order): `node scripts/seed.mjs --with-splits`.

### G10. Scenario 6: Submit and day approval (20 minutes)
Branch `gerson/g10-submit-approve`. Submit: apply the adjustments (set `employee_adjusted` true on changed rows, recompute percents, refuse if the minutes no longer add up), status `submitted`, stamp `submitted_at`. Day approval: for each id, only if status is `submitted`, set `approved` or `returned` with approver, time and comment. If Gerson prefers, Marcus's server can do these two writes directly. Decide now, tell Marcus, record it in `docs/decisions.md`.

### G11. Scenario 7: Suggest workflows (40 minutes)
Branch `gerson/g11-suggest`. Input `{ company_id, period_start, period_end }`. Read approved `day_allocations` in the period. Roll up in make.com or, better, in a Supabase view `team_history` created in a migration `0003`: per person and label, total minutes, days seen, minutes by weekday, `in_role`, and expected share where a topic exists. Claude with `prompts/04_suggest_workflows.md`. Then in make.com: `annual_cost_eur` from hours and each affected person's hourly cost, `total_score` from the formula in `AGENTS.md`, rank by it. Delete earlier `proposed` candidates for the company and insert the new ones.
Check: with the seeded history, "Weekly client status report" (from the label "Manual status reporting") ranks first and "Timesheet reconciliation" appears lower.

### G12. Scenario 8: Decision and draft creation (60 minutes)
Branch `gerson/g12-draft`. Unchanged from version 1 in spirit. Reliable beats clever.
1. Gerson builds by hand one template scenario, `TEMPLATE: Weekly client status report`: weekly schedule, Google Sheets "Search rows" (the project tracker), Anthropic Claude "Create a message" (write the status summary), Gmail "Create a draft". Export its blueprint to `make/blueprints/template_weekly_status_report.json`. You turn it into a `.tpl.json` with placeholders `{{scenario_name}}`, `{{source_sheet_name}}`, `{{recipients}}`, `{{summary_prompt}}` and a matching scheduling object.
2. Scenario eight: insert the `approvals` row. If rejected, mark the candidate and reply. If approved: Claude with `prompts/05_draft_workflow_fill.md`, fill the template, call the make.com API `POST /api/v2/scenarios` on the account's zone with `Authorization: Token <token>` and body `{ teamId, blueprint (as a JSON string), scheduling (as a JSON string), folderId }` for the folder `Workflow Scout drafts`. The scenario is created switched off, which is right: a draft for a human to finish. Save `make_scenario_id` and `make_scenario_url`, status `drafted`, reply with the link.
3. A candidate that does not fit the template still gets a draft from the template, renamed, with its `proposed_steps` in the scenario notes. Say so honestly in the README.
Checks: approve from Marcus's screen three times, each link opens a real draft. Delete the test drafts.

### G13. The agent (30 minutes, only if tasks G7 to G12 are done)
A make.com AI Agent called `Workflow Scout` with a system prompt describing its job (keep each person's picture of their working day current, chase missing check ins, surface automation candidates, never create a draft without a recorded approval) and the scenarios above registered as its tools. Add `Scout 0: Weekly review`, scheduled Monday 08:00, which asks the agent to refresh role documents, list who has not checked in, and run the suggestion review. If the AI Agents feature is not on the plan, a plain scenario that calls the others in order does the same job. Record which in `docs/decisions.md`.

### G14. Deploy (20 minutes)
Vercel project on `frontend/`, every variable from `AGENTS.md` section 7, `NEXT_PUBLIC_APP_URL` set to the deployed address, and the same address used in the morning email. Confirm the server routes reach make.com from the deployed site.

### Checkpoint two, 22:30
Feature freeze with Marcus. Write Sunday's list in `docs/sunday.md`, including "make the repository public before 11:30" from decision 1.

---

## Sunday 20 September

### G15. Two clean runs (09:00 to 09:40)
`supabase/reset.sql`, delete old draft scenarios, then the whole story twice. Fix only what breaks the story.

### G16. Quality Clouds scanner (09:40 to 10:15)
Run Norma (`github.com/qualityclouds/norma-mcp` or norma.qualityclouds.com). Fix at least one real issue. Give Marcus what was fixed and what was left, with file names, for `DEFENCE.md`.

### G17. Secrets sweep (10:15 to 10:30)
Search the repository history and every blueprint for keys, tokens, webhook addresses and access tokens. Code freeze at 10:30.

### G18. README and going public (10:30 to 11:15)
What it is in three sentences. The demo story. A Mermaid diagram of the agent and its scenarios. "Where make.com powers it" as a plain list. How to run it. Honest limits: made up data, personal links without passwords, one draft template, a fixed demo day, pre-loaded history. Roadmap. Then make the repository public and check it opens in a private browser window.

### G19. Demo duty (11:15 onwards)
Gerson drives, Marcus presents. Before each judging round: `supabase/reset.sql`, delete old drafts, run the morning routine once so a fresh email is waiting. Keep make.com and Vercel running until 18:00.

---

## If something goes wrong
- An interview turn takes longer than 12 seconds: cut the context to activity titles, times and minutes, lower max tokens, and fetch the context in one call.
- Claude returns broken JSON: the retry route in the shared pattern. If it persists, send less input.
- The make.com API refuses the filled blueprint: create the draft from the untouched template and only change its name.
- Google Calendar or Google Drive connection trouble for more than 20 minutes: use the seed script flags and note in the README that the live connection is the intended design.
- Email sending trouble: skip it, open the link from `docs/demo_links.md`, show the scenario to the judges.
