# AGENTS.md: shared rules and data contract

This file sits at the repository root. Every coding agent (Claude Code, Codex) reads it before doing anything. Copy it to `CLAUDE.md` as well, or make `CLAUDE.md` a one line file that says "Read AGENTS.md and follow it".

Human owners: Marcus (product, interface, data, prompts) and Gerson (database, make.com, deployment). Each has their own build file: `docs/BUILD_MARCUS.md` and `docs/BUILD_GERSON.md`.

## 1. What we are building
Product working name: **Workflow Scout**. Repository: `github.com/gmonteskeet/timewarden` (already created by Gerson). Hackathon: HackBarna 2026, make.com challenge. Deadline: Sunday 20 September 2026, 12:00 Madrid time. We submit at 11:30.

An agent that lives inside a company. It listens to how an employee says they spent their time (voice note), checks that against what their calendar and call transcripts show, asks sharp follow up questions about what it cannot explain, compares the result with the person's job description, ranks what should be automated, gets human approval, and creates a real draft workflow in make.com.

The one demo story, which every task serves:
1. Elena Ruiz, Senior Client Consultant at the made up firm Brightline Advisory, records a voice note about her week. She under reports her manual reporting work.
2. The agent has already read her Google Calendar and three call transcripts.
3. The agent asks three kinds of questions: a meeting it cannot explain, a gap in her calendar, and a mismatch between what she said and what it saw.
4. Elena opens her "said versus seen" view, agrees with most findings and corrects one.
5. Her manager, Tomas Berg, sees the ranked automation candidates. The top one is "Weekly client status report". He approves it.
6. A real draft scenario appears in the make.com account.

## 2. Hard rules
1. Nothing is copied in from earlier projects. All code is written this weekend.
2. No secrets in the repository. Keys live in `.env.local` (interface) and inside make.com connections. `.env.example` lists names only.
3. Folder ownership. Do not edit a folder you do not own. If you must, stop and tell your human.
   - Marcus owns: `frontend/`, `data/`, `prompts/`, `docs/` (except `docs/BUILD_GERSON.md`)
   - Gerson owns: `supabase/`, `make/`, `scripts/`, deployment settings, `README.md`
   - Shared, change only with both humans agreeing: `AGENTS.md`, `CLAUDE.md`, `frontend/lib/contract.ts`
4. Branches: `marcus/<task-id>-short-name` or `gerson/<task-id>-short-name`. One task, one branch, one pull request, merged within 90 minutes. Never push straight to `main`.
5. `main` must always run. Before every merge: `npm run lint && npm run build` inside `frontend/` must pass.
6. Commit messages: plain English, present tense, start with the task id. Example: `M4 add said versus seen screen`.
7. All written copy (interface text, README, documents): British spelling, plain English, no em dashes, no jargon, no placeholder text such as "lorem ipsum".
8. Never refer to anything only by a code. Write "the scoring scenario", not "S5", in anything a human reads in the interface.
9. Scope guard. If a task is not in a build file, do not build it. Suggest it to your human instead.
10. Never cut: voice note, interview questions, human approval, real draft workflow in make.com.
11. After each task: run the checks listed in the task, tick the task in the build file, commit, open the pull request, then stop and report to your human in three lines: what was done, what was checked, what is next.

## 3. Stack
- Interface: Next.js (App Router, TypeScript, Tailwind CSS) in `frontend/`, deployed on Vercel.
- Database: Supabase (Postgres). Schema in `supabase/migrations/`.
- Agent logic: make.com scenarios. Exported blueprints (the JSON description of each scenario) are saved in `make/blueprints/`.
- AI model: Anthropic Claude, called from inside make.com through the built in "Anthropic Claude" app. Use model `claude-sonnet-4-5` unless the account offers something newer. We only have an Anthropic key.
- Voice to text: the browser's built in speech recognition (Web Speech API, works in Chrome). Reason: we have no speech to text key, and Claude does not accept audio. A typed fallback box must always be available.
- Calendar: a real Google Calendar read by make.com's Google Calendar app.
- Transcripts: text files in `data/transcripts/`, loaded into the database by a seed script.

## 4. How the parts talk to each other
```
Browser (Next.js)  --reads-->  Supabase (public read key)
Browser  --POST-->  Next.js API route (server)  --POST-->  make.com webhook
make.com scenarios  --read and write-->  Supabase (service key, held in make.com)
make.com draft creation scenario  --POST-->  make.com API (creates the draft scenario)
```
The browser never calls make.com directly and never holds the service key or webhook addresses.

## 5. Data contract: database tables
All ids are `uuid default gen_random_uuid()`. All tables have `created_at timestamptz default now()`.

**companies**: `id`, `name`
**people**: `id`, `company_id`, `full_name`, `role_title`, `team`, `manager_id` (nullable, people.id), `job_description` (text), `performance_criteria` (jsonb array of strings), `hourly_cost_eur` (numeric), `calendar_id` (text, nullable)
**activities**: `id`, `person_id`, `source` (text: `calendar` | `transcript` | `voice`), `title`, `description` (text, nullable), `starts_at` (timestamptz, nullable), `ends_at` (timestamptz, nullable), `minutes` (int), `attendees` (jsonb array of strings), `category` (text, nullable, set by the scoring scenario), `week_start` (date)
**transcripts**: `id`, `person_id`, `title`, `occurred_at`, `minutes`, `in_calendar` (boolean), `body` (text)
**voice_notes**: `id`, `person_id`, `week_start`, `transcript_text`, `status` (text: `received` | `processed`)
**interview_questions**: `id`, `person_id`, `week_start`, `kind` (text: `unexplained_meeting` | `calendar_gap` | `mismatch`), `question`, `evidence` (text, what the agent saw), `answer` (text, nullable), `answered_at` (nullable)
**findings**: `id`, `person_id`, `week_start`, `category`, `said_minutes` (int), `seen_minutes` (int), `in_job_description` (boolean), `summary` (text), `employee_verdict` (text: `pending` | `agree` | `disagree`), `employee_comment` (nullable), `manager_verdict` (same values), `manager_comment` (nullable)
**candidates**: `id`, `company_id`, `person_id`, `title`, `description`, `hours_per_week` (numeric), `annual_cost_eur` (numeric), `score_time`, `score_repetitive`, `score_reliability`, `score_role_distance` (each int 1 to 5), `total_score` (numeric), `rank` (int), `reasoning` (text), `proposed_steps` (jsonb array of `{app, action, note}`), `status` (text: `proposed` | `approved` | `rejected` | `drafted`), `make_scenario_id` (nullable), `make_scenario_url` (nullable)
**approvals**: `id`, `candidate_id`, `approver_id`, `decision` (text: `approved` | `rejected`), `comment` (nullable)

Scoring formula (fixed, so both sides agree):
`total_score = 0.35 * score_time + 0.20 * score_repetitive + 0.15 * score_reliability + 0.30 * score_role_distance`
"Role distance" means how far the activity is from the job description and performance criteria. 5 means "nothing to do with the job this person was hired for".

Security for the hackathon: row level security on, with a policy allowing public read on all tables. All writes go through make.com or server routes using the service key. This is acceptable only because every row is made up data. Record this choice in `DEFENCE.md`.

## 6. Data contract: webhooks (Next.js server route to make.com)
All are HTTP POST with JSON, header `x-scout-key: <SCOUT_SHARED_SECRET>`. make.com rejects calls without it. All reply with JSON `{ "ok": true, ... }` within 40 seconds.

| Purpose | Env name of the address | Request body | Reply adds |
|---|---|---|---|
| Voice note received | `MAKE_WEBHOOK_VOICE` | `{ person_id, week_start, transcript_text }` | `{ voice_note_id, questions_created }` |
| Interview answer | `MAKE_WEBHOOK_ANSWER` | `{ question_id, answer }` | `{ remaining }` and, when `remaining` is 0, the scoring scenario runs |
| Finding verdict | `MAKE_WEBHOOK_VERDICT` | `{ finding_id, role: "employee" \| "manager", verdict, comment }` | none |
| Candidate decision | `MAKE_WEBHOOK_DECISION` | `{ candidate_id, approver_id, decision, comment }` | `{ make_scenario_url }` when approved |

Simple writes (verdicts) may be done by the Next.js server route straight to Supabase if Gerson prefers. The voice, answer and decision webhooks must go through make.com, because that is what the judges score.

## 7. Environment variable names
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `MAKE_WEBHOOK_VOICE`, `MAKE_WEBHOOK_ANSWER`, `MAKE_WEBHOOK_VERDICT`, `MAKE_WEBHOOK_DECISION`, `SCOUT_SHARED_SECRET`, `NEXT_PUBLIC_USE_FIXTURES` (`true` makes the interface run on the fake data in `frontend/lib/fixtures.ts`), `NEXT_PUBLIC_DEMO_WEEK_START` (`2026-09-14`).

## 8. Fixed demo values
- Company: Brightline Advisory. Team: Client Delivery.
- People: Elena Ruiz (Senior Client Consultant, main character), Tomas Berg (Head of Client Delivery, her manager), Priya Nair (Consultant), Jonas Weber (Business Analyst).
- Demo week: Monday 14 September 2026 to Friday 18 September 2026. `week_start` is `2026-09-14`. Timezone Europe/Madrid.

## 9. Cut order if we fall behind
First: transcript intake. Second: team and company roll up. Third: the manager's agree or disagree on findings (keep the approve button). Never cut the four items in rule 10.
