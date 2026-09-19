# AGENTS.md: shared rules and data contract (version 2)

Version 2, written Saturday 19 September 2026 at 17:00 Madrid time, after the session with the make.com mentor. It replaces version 1 completely. `docs/CHANGES_V2.md` explains what changed and what happens to work already done.

This file sits at the repository root. Every coding agent (Claude Code, Codex) reads it before doing anything. Human owners: Marcus (product, interface, demo data, prompts) and Gerson (database, make.com, deployment). Each has a build file: `docs/BUILD_MARCUS.md` and `docs/BUILD_GERSON.md`.

## 1. What we are building
Product working name: **Workflow Scout**. Repository: `github.com/gmonteskeet/timewarden`. Hackathon: HackBarna 2026, make.com challenge. Deadline: Sunday 20 September 2026, 12:00 Madrid time. We submit at 11:30.

A web app with two kinds of user, manager and employee, sitting on top of a make.com agent.

1. **Set up.** A make.com scenario reads one document per role (job description and performance measures) from the company's document store. The AI turns each role into an expected split of time by topic, for example "Client delivery 45 percent". The manager reviews, adjusts and approves the split for each role.
2. **Every morning.** make.com reads each employee's calendar and call transcripts for the previous working day, then emails them a personal link: "Tell Scout about yesterday".
3. **The check in.** The link opens an interview that starts at once, by voice or by text. The AI already knows the calendar and the calls. It asks about gaps ("Your calendar was empty between 09:00 and 11:00. What were you working on?"), about meetings it cannot explain, and follow up questions until it is confident how the day divides across the role's topics. It stops itself, normally within six questions.
4. **The summary.** Always the same layout: one bar per topic, expected long term share next to the actual share for that day, plus any time spent outside the role. The employee can correct it, then submits.
5. **Manager approval.** The manager approves submitted days for the team, one day at a time or a week at a time.
6. **Over time.** The AI reviews the approved history, finds time that keeps going to the wrong places, and suggests make.com workflows to take that work over. The manager approves one and a real draft scenario is created in make.com.

The one demo story, which every task serves:
1. Tomas Berg, Head of Client Delivery at the made up firm Brightline Advisory, opens Roles. Scout has read four role documents and proposes a time split for each. He nudges one number and approves.
2. Elena Ruiz, Senior Client Consultant, opens her morning email and clicks the link. Scout interviews her about Friday 18 September. It asks about the empty 09:00 to 11:00 slot and about the two and a half hour "Friday report send out".
3. Elena sees her summary: expected against actual. "Manual status reporting" shows as two and a half hours outside her role. She corrects one number and submits.
4. Tomas approves Elena's day. He opens Suggestions. Scout has reviewed three weeks of approved days for the team and ranks "Weekly client status report" first. He approves it.
5. A real draft scenario appears in the make.com account.

## 2. Hard rules
1. Nothing is copied in from earlier projects. All code and content is written this weekend.
2. No secrets in the repository. Keys live in `frontend/.env.local` and inside make.com connections. `.env.example` lists names only. Webhook addresses and personal access tokens count as secrets.
3. Folder ownership. Do not edit a folder you do not own. If you must, stop and tell your human.
   - Marcus owns: `frontend/`, `data/`, `prompts/`, `docs/` (except `docs/BUILD_GERSON.md` and `docs/decisions.md`)
   - Gerson owns: `supabase/`, `make/`, `scripts/`, deployment settings, `README.md`, `docs/decisions.md`
   - Shared, change only with both humans agreeing: `AGENTS.md`, `CLAUDE.md`, `frontend/lib/contract.ts`
4. Branches: `marcus/<task-id>-short-name` or `gerson/<task-id>-short-name`. One task, one branch, one pull request, merged within 90 minutes. Never push straight to `main`.
5. `main` must always run. Before every merge: `npm run lint && npm run build` inside `frontend/` must pass.
6. Commit messages: plain English, present tense, start with the task id.
7. All written copy (interface text, emails, README, documents): British spelling, plain English, no em dashes, no jargon, no placeholder text.
8. Never refer to anything only by a code in anything a human reads in the interface.
9. Scope guard. If a task is not in a build file, do not build it. Suggest it to your human.
10. Never cut: the interview, the expected against actual summary, employee submit and manager approval, and the suggestion that becomes a real draft workflow in make.com.
11. After each task: run its checks, tick it in the build file, commit, open the pull request, then stop and report to your human in three lines: what was done, what was checked, what is next.
12. Privacy wording. Everywhere the employee sees their data, the interface says plainly that this is for finding work to automate, not for judging people, and that the manager sees a day only after the employee submits it.

## 3. Stack
- Interface: Next.js (App Router, TypeScript, Tailwind CSS) in `frontend/`, deployed on Vercel.
- Database: Supabase (Postgres). Schema in `supabase/migrations/`.
- Agent logic: make.com scenarios. Build sheets in `make/specs/`, exported blueprints in `make/blueprints/`.
- AI model: Anthropic Claude, called from inside make.com through the built in Anthropic Claude app. Model as recorded in `make/specs/README.md`.
- Document store for role documents: **Google Drive by default**, read by make.com. SharePoint is a drop in replacement for the first module only. Decision and reason in `docs/CHANGES_V2.md`.
- Calendar: a real Google Calendar read by make.com.
- Transcripts: text files in `data/transcripts/`, loaded into the database by the seed script. They stand in for a recording tool such as Granola.
- Morning email: make.com Gmail module (or the make.com Email app), sending to addresses Marcus and Gerson control.
- Voice: a voice layer with three modes behind one switch.
  - `text`: typed chat. Always available. Build first.
  - `browser`: the browser's own speech recognition and speech synthesis (Chrome). No key needed.
  - `slng`: SLNG speech to text and text to speech, called through our own server routes so the key stays on the server. Documentation for agents: `https://docs.slng.ai/llms.txt`. Time boxed upgrade, first thing to cut.
  In all three modes the questions come from the same place: the interview scenario in make.com. The voice layer only changes how words go in and out.

## 4. How the parts talk to each other
```
Browser  --only ever talks to-->  Next.js server (pages and /api routes)
Next.js server  --reads and writes-->  Supabase, using the service key, filtered by who is signed in
Next.js server  --POST with x-scout-key-->  make.com webhooks
make.com scenarios  --read and write-->  Supabase (service key held in make.com)
make.com  --reads-->  document store, Google Calendar      make.com  --sends-->  morning emails
make.com draft creation scenario  --POST-->  make.com API (creates the draft scenario)
```
The browser never holds a database key, a webhook address or the SLNG key. There is no public read access to the database in version 2.

### Users and rights (the light login)
- Every person has a secret `access_token`. The morning email link is `/enter/<access_token>?next=/check-in/<check_in_id>`. Opening it sets a signed, http only session cookie holding `person_id` and `app_role`, then redirects.
- The home page has a clearly labelled "Demo sign in" list of the four people, for judges. It uses the same mechanism.
- Rights are enforced on the server in one place, `frontend/lib/session.ts` and `frontend/lib/data.ts`: an employee can read and change only their own check ins. A manager can read the people whose `manager_id` is them, approve their days, approve role splits and approve suggestions. Every server route checks the session first.
- There are no passwords. Say so honestly in the README.

## 5. Data contract: database tables
All ids are `uuid default gen_random_uuid()`. All tables have `created_at timestamptz default now()`. Migration `0002` moves the schema from version 1 to this. Row level security stays on with **no** policies for the anonymous role.

**companies**: `id`, `name`
**roles**: `id`, `company_id`, `title`, `document_name`, `document_url` (nullable), `job_description` (text), `kpis` (jsonb array of strings), `split_status` (text: `proposed` | `approved`), `split_approved_by` (nullable, people.id), `split_approved_at` (nullable), `source_read_at` (timestamptz)
**topics**: `id`, `role_id`, `name`, `description`, `expected_percent` (numeric, the approved or proposed share), `proposed_percent` (numeric, what the AI first proposed), `reasoning` (text, one sentence), `sort_order` (int). The `expected_percent` values of one role always add up to 100.
**people**: `id`, `company_id`, `role_id`, `full_name`, `email`, `app_role` (text: `manager` | `employee`), `team`, `manager_id` (nullable), `hourly_cost_eur` (numeric), `calendar_id` (nullable), `access_token` (text, unique), `working_minutes_per_day` (int, default 480). The version 1 columns `role_title`, `job_description` and `performance_criteria` move to `roles`.
**activities**: `id`, `person_id`, `day` (date), `source` (text: `calendar` | `transcript` | `interview`), `title`, `description` (nullable), `starts_at` (nullable), `ends_at` (nullable), `minutes` (int), `attendees` (jsonb array of strings)
**transcripts**: `id`, `person_id`, `title`, `occurred_at`, `minutes`, `in_calendar` (boolean), `body` (text)
**check_ins**: `id`, `person_id`, `day` (date, the working day being described), `status` (text: `invited` | `in_progress` | `summarised` | `submitted` | `approved` | `returned`), `invited_at`, `submitted_at` (nullable), `approved_by` (nullable), `approved_at` (nullable), `manager_comment` (nullable), `summary_text` (nullable, two plain sentences). Unique on (`person_id`, `day`).
**interview_turns**: `id`, `check_in_id`, `turn_no` (int), `speaker` (text: `scout` | `employee`), `text`, `kind` (nullable, for scout turns: `opening` | `calendar_gap` | `unexplained_meeting` | `elaboration` | `confirmation` | `closing`), `evidence` (nullable, what Scout saw that prompted the question)
**day_allocations**: `id`, `check_in_id`, `person_id`, `day`, `topic_id` (nullable), `label` (text: the topic name when `topic_id` is set, otherwise a short plain name for the outside role work, for example "Manual status reporting"), `in_role` (boolean), `minutes` (int), `percent` (numeric), `evidence` (text), `employee_adjusted` (boolean default false). For one check in, `minutes` add up to the person's working minutes for that day and `percent` adds up to 100.
**candidates**: `id`, `company_id`, `title`, `description`, `source_label` (the outside role label or topic it comes from), `people_affected` (int), `hours_per_week` (numeric, team total), `annual_cost_eur` (numeric), `period_start` (date), `period_end` (date), `score_time`, `score_repetitive`, `score_reliability`, `score_role_distance` (each int 1 to 5), `total_score` (numeric), `rank` (int), `reasoning` (text), `proposed_steps` (jsonb array of `{app, action, note}`), `status` (text: `proposed` | `approved` | `rejected` | `drafted`), `make_scenario_id` (nullable), `make_scenario_url` (nullable)
**approvals**: `id`, `candidate_id`, `approver_id`, `decision` (text: `approved` | `rejected`), `comment` (nullable)

Dropped from version 1: `voice_notes`, `interview_questions`, `findings`.

Scoring formula (unchanged, computed in make.com, never by the model):
`total_score = 0.35 * score_time + 0.20 * score_repetitive + 0.15 * score_reliability + 0.30 * score_role_distance`
`annual_cost_eur` = sum over affected people of (their hours per week * 46 * their hourly cost).

## 6. Data contract: webhooks (Next.js server route to make.com)
All are HTTP POST with JSON and header `x-scout-key: <SCOUT_SHARED_SECRET>`. All reply with JSON `{ "ok": true, ... }`. The interview webhook must reply within 12 seconds. The others within 40 seconds, or reply early and let the interface poll.

| Purpose | Env name | Request body | Reply adds |
|---|---|---|---|
| Read role documents and propose splits | `MAKE_WEBHOOK_ROLES_SYNC` | `{ company_id }` | `{ roles_read, topics_proposed }` |
| Manager approves a role's split | `MAKE_WEBHOOK_SPLIT_APPROVAL` | `{ role_id, approver_id, topics: [{ topic_id, expected_percent }] }` | none |
| Run the morning routine now | `MAKE_WEBHOOK_MORNING_RUN` | `{ company_id, day }` | `{ check_ins_created, emails_sent }` |
| One interview turn | `MAKE_WEBHOOK_INTERVIEW` | `{ check_in_id, employee_text }` (`employee_text` is null on the first call) | `{ done, turn_no, question, kind, evidence }`. When `done` is true, `question` is the closing line and the summary scenario has been started |
| Employee submits the day | `MAKE_WEBHOOK_SUBMIT` | `{ check_in_id, adjustments: [{ allocation_id, minutes }] }` | none |
| Manager approves or returns days | `MAKE_WEBHOOK_DAY_APPROVAL` | `{ check_in_ids: [...], approver_id, decision: "approved" \| "returned", comment }` | none |
| Review history and suggest workflows | `MAKE_WEBHOOK_SUGGEST` | `{ company_id, period_start, period_end }` | `{ candidates_created }` |
| Manager decides on a suggestion | `MAKE_WEBHOOK_DECISION` | `{ candidate_id, approver_id, decision, comment }` | `{ make_scenario_url }` when approved |

Gerson may choose to let the Next.js server write submit and day approval straight to the database. Split approval, the interview, suggestion and the decision must run through make.com, because that is what the judges score.

## 7. Environment variable names
Server only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `SCOUT_SHARED_SECRET`, `MAKE_WEBHOOK_ROLES_SYNC`, `MAKE_WEBHOOK_SPLIT_APPROVAL`, `MAKE_WEBHOOK_MORNING_RUN`, `MAKE_WEBHOOK_INTERVIEW`, `MAKE_WEBHOOK_SUBMIT`, `MAKE_WEBHOOK_DAY_APPROVAL`, `MAKE_WEBHOOK_SUGGEST`, `MAKE_WEBHOOK_DECISION`, `SLNG_API_KEY`.
Public: `NEXT_PUBLIC_USE_FIXTURES` (`true` runs the whole interface on the fake data in `frontend/lib/fixtures.ts`), `NEXT_PUBLIC_VOICE_MODE` (`text` | `browser` | `slng`), `NEXT_PUBLIC_DEMO_DAY` (`2026-09-18`), `NEXT_PUBLIC_APP_URL`.

## 8. Fixed demo values
- Company: Brightline Advisory. Team: Client Delivery.
- People and roles: Elena Ruiz, Senior Client Consultant (employee, main character). Tomas Berg, Head of Client Delivery (manager). Priya Nair, Consultant (employee). Jonas Weber, Business Analyst (employee).
- The live demo day is Friday 18 September 2026. The interface calls it "your last working day", not "yesterday", because the demo is on a Sunday.
- Pre-loaded history: approved check ins for Elena, Priya and Jonas for the 14 working days from Monday 31 August to Thursday 17 September 2026.
- Timezone Europe/Madrid.

## 9. Cut order if we fall behind
1. SLNG voice (keep `browser` and `text`).
2. Transcript intake (keep it in the pitch).
3. The employee's own history page.
4. Reading role documents live from the document store (load them with the seed script and show the scenario).
5. The weekly view in manager approval (keep daily).
6. Sending the morning email live (show the scenario and open the link by hand).
Never cut the four items in rule 10.
