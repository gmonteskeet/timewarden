# BUILD_MARCUS.md: interface, demo data and prompts (version 2)

You are the coding agent working for Marcus on the Workflow Scout hackathon build. Marcus is the product owner and is not a programmer. Explain what you are doing in plain English, keep questions short, and never ask him for a technical decision without giving a recommendation.

**Before anything else:** read `AGENTS.md` (version 2) and `docs/CHANGES_V2.md`. They override anything you remember from version 1. Work through the tasks in order. One task, one branch, one pull request. After each task, run its checks, tick it here and report in three lines.

You own: `frontend/`, `data/`, `prompts/`, `docs/`. Do not edit `supabase/`, `make/` or `scripts/`.

Done already: task M0 (planning documents) and task M1 (demo company data, version 1 shape). Merge task M1 as it is before starting task M2.

Times are Madrid time, Saturday 19 September unless stated. If a task runs 30 minutes over, stop and tell Marcus so he can cut scope using `AGENTS.md` section 9.

---

## Phase 1: to checkpoint one at 20:00

### M2. Demo data, version 2 (40 minutes, 17:15 to 17:55)
Branch `marcus/m2-demo-data-v2`. Extend the task M1 files. British English, realistic, specific.

- `data/role_documents/`: one Markdown document per role, written as a real HR document of 250 to 400 words: `senior_client_consultant.md`, `head_of_client_delivery.md`, `consultant.md`, `business_analyst.md`. Each has: role purpose, main responsibilities, and five performance measures. Move the wording from the `job_description` and `performance_criteria` in `data/people.json`. None of the documents mentions building weekly status reports as a responsibility, except the Business Analyst's, where "supporting project reporting" is a small part. That contrast is the point.
- `data/people.json`: for each person replace `role_title`, `job_description` and `performance_criteria` with `role_key` (matching the document file name), and add `email` (placeholder `@brightline.example` addresses, Marcus swaps in real inboxes locally), `app_role` (`manager` for Tomas, `employee` for the rest) and `working_minutes_per_day` (480). Keep `key`, `manager_key`, `team`, `hourly_cost_eur`.
- `data/expected_splits.json`: the split we expect the AI to propose for each role, five or six topics each adding up to 100. Used for the fake data and as a sanity check on the real AI output, never loaded as if it were the AI's work. For the Senior Client Consultant: Client delivery and workshops 45, Client relationships 20, Proposals and business development 15, Coaching juniors 10, Internal meetings and administration 10.
- `data/transcripts/2026-09-18_unplanned_call.txt`: new, `in_calendar: false`, Friday 18 September at 09:20, 40 minutes. The Northmere Foods client rings to ask why two figures in last week's status report do not match the tracker. Elena explains she copies them across by hand every Friday. This sits inside the empty 09:00 to 11:00 calendar slot.
- `data/interview_script.md`: replaces `voice_note_script.md` and `interview_answers.md` (delete both). Elena's scripted answers for the Friday interview, so the demo is repeatable: what she did 09:00 to 11:00 (the client call, then fixing the two figures in the status pack), what "Friday report send out" involves (copying figures from the project tracker into slides, formatting, emailing eight clients, every single week), and one short answer each for two likely follow ups.
- `data/make_history.mjs`: a Node script with no dependencies that writes `data/history.json`: approved check ins with day allocations for Elena, Priya and Jonas for the 14 working days from 31 August to 17 September 2026. Use a fixed seed so it is repeatable. Pattern: each person follows their role's expected split with a day to day wobble of a few points, except "Manual status reporting" (label, outside role) takes about 2.5 hours every Friday and 1 hour every Monday for Elena, about 1.5 hours on Fridays for Priya, and about 3 hours spread across the week for Jonas. Also include a smaller repeating outside role item: "Timesheet reconciliation", 45 minutes each Monday for all three. Minutes per day add up to 480, percents to 100. Shape must match the `check_ins` and `day_allocations` tables in `AGENTS.md`, using `person_key` and `topic_name` so Gerson's seed script can link them.

Checks: all JSON parses. Run `make_history.mjs` twice and confirm identical output. Print for Marcus: average weekly hours of "Manual status reporting" per person and for the team. **Then tell Marcus to message Gerson that the data files are ready.**

### M3. Calendar and role documents into Google (20 minutes, mostly Marcus by hand)
Branch `marcus/m3-calendar-ics`. Write `data/make_ics.mjs` (Node, no dependencies): reads `data/calendar_week.json`, writes `data/elena_week.ics` in valid iCalendar format, timezone Europe/Madrid, one event per entry with description and attendees. Check the event count matches.
Then give Marcus these manual steps **one at a time, waiting for him to confirm each**:
1. In Google Calendar create a calendar called "Scout demo: Elena Ruiz" and import `data/elena_week.ics` into it.
2. In Google Drive create a folder called "Brightline Advisory role documents" and upload the four files from `data/role_documents/` as Google Docs.
3. Send Gerson the calendar ID and the Drive folder link by direct message.

### M4. Prompts (45 minutes, 18:15 to 19:00). Gerson is waiting on these.
Branch `marcus/m4-prompts`. Each prompt file is complete and standalone: role, inputs by exact name, JSON only output, exact output shape using the field names in `AGENTS.md`, rules, and one worked example using Brightline data. Delete any version 1 prompt files.

- `prompts/01_propose_role_split.md`: input `role_title`, `job_description`, `kpis`. Output `{ topics: [{ name, description, proposed_percent, reasoning }] }`. Five or six topics. Percents are whole numbers that add up to 100. Always include one topic for internal meetings and administration, between 5 and 15. Topic names are short and plain. `reasoning` is one sentence that points at the job description or a performance measure.
- `prompts/02_interview_turn.md`: the most important prompt. Input `person_name`, `role_title`, `topics` (approved), `day`, `working_minutes`, `calendar_activities`, `transcript_activities`, `turns_so_far`. Output `{ done, question, kind, evidence }`. Rules:
  - Turn one is a warm one sentence opening plus the first real question. Never open with small talk alone.
  - Priority order for what to ask: empty calendar stretches of 60 minutes or more between 09:00 and 18:00; meetings with no description and a title that gives no purpose; long blocks whose content is unclear; then elaboration ("how much of that was hands on, and does it happen every week?") wherever it is not yet clear which topic the time belongs to or whether the work repeats.
  - One question per turn, one sentence, quoting the time and duration. Friendly, curious, never accusing. Never ask about something a transcript already explains. Instead confirm it briefly.
  - Never more than six questions. Set `done` to true as soon as at least 90 percent of the working minutes can be placed with confidence, and make `question` a one sentence thank you that says the summary is ready.
  - `evidence` states what Scout saw, in plain words, for example "Nothing in your calendar from 09:00 to 11:00. One unplanned 40 minute call was recorded at 09:20."
- `prompts/03_day_summary.md`: input as above plus the full interview. Output `{ allocations: [{ topic_name | null, label, in_role, minutes, evidence }], summary_text }`. Minutes add up to `working_minutes` exactly. Work that fits no topic gets `topic_name` null, `in_role` false and a short plain `label`. Reuse a label from `known_outside_labels` (an input list) when the work is the same, so the history lines up across days. Count each real hour once.
- `prompts/04_suggest_workflows.md`: input `period_start`, `period_end`, `team_history` (allocations rolled up per person, per label, per weekday), `people` (with hourly cost), `roles_and_topics`. Output `{ candidates: [...] }` with every candidate field in `AGENTS.md` except ids, rank, status, total score and annual cost. Only work that is outside the role or far above its expected share, and that is repetitive and rule based, becomes a candidate. Client facing work is never proposed. `proposed_steps` names real make.com apps. `reasoning` is two plain sentences a manager would understand, naming the people and the hours.
- `prompts/05_draft_workflow_fill.md`: input one approved candidate and the template description. Output `{ scenario_name, schedule, source_sheet_name, recipients, summary_prompt }`.
- `prompts/README.md`: which make.com scenario uses which prompt.

Checks: field names match `AGENTS.md` exactly. Each prompt has a worked example. **Tell Marcus to send Gerson the pull request link the moment it merges.**

### M5. Interface foundations on fake data (60 minutes, 19:00 to 20:00)
Branch `marcus/m5-interface-foundations`. `frontend/` exists from Gerson's task G1. Read `frontend/AGENTS.md` first and follow it.

- `frontend/lib/contract.ts`: TypeScript types for every table and webhook body in `AGENTS.md` version 2. Shared file: after this task, no field name changes without both humans agreeing.
- `frontend/lib/fixtures.ts`: fake data in the contract shape: the four people, four roles with topics from `data/expected_splits.json`, Elena's Friday check in with a scripted six turn interview and a finished set of day allocations, three weeks of history (import `data/history.json`), four candidates.
- `frontend/lib/session.ts`: the light login from `AGENTS.md` section 4. `/enter/[token]` sets a signed http only cookie (`SESSION_SECRET`), supports `?next=`. Helpers `getSession()`, `requireEmployee()`, `requireManager()`.
- `frontend/lib/data.ts`: every read and write the screens need, each one checking rights first, each returning fixtures when `NEXT_PUBLIC_USE_FIXTURES=true` and otherwise using Supabase with the service key on the server only. Screens never touch Supabase directly.
- `frontend/lib/make.ts`: one function per webhook in `AGENTS.md` section 6, adding the `x-scout-key` header. In fixtures mode each returns a canned reply after a short delay. The interview function in fixtures mode walks through the scripted turns.
- `frontend/components/AllocationBars.tsx`: **the one standard summary component, used everywhere.** One row per topic: name, a bar for expected share and a bar for actual share on the same 0 to 100 scale, the numbers at the end of the bars, in role topics first in `sort_order`, then a separate group headed "Outside your role" with actual bars only. Props allow "actual" to be one day, a week or a longer period, and allow editing minutes. Same colours, order and layout every time, because the mentor asked for a summary that always looks the same. Two colours only: one for expected, one for actual, with outside role bars in a warning tone. Large type for a projector.
- Layout and navigation: a top bar with the product name, the signed in person's name and role, and links that depend on the role. Home page with the labelled demo sign in.

Checks: `npm run lint && npm run build` pass. In fixtures mode, signing in as Elena and as Tomas shows different navigation, and Elena cannot open a manager page.

### Checkpoint one, 20:00
Tell Marcus what runs on fake data and whether one real interview turn has been tried with Gerson.

---

## Phase 2: 20:00 to 22:30 (dinner is at 20:00, keep it short)

### M6. The check in: interview and summary (60 minutes)
Branch `marcus/m6-check-in`.
- `/check-in/[id]`: the interview starts the moment the page opens, by calling the interview function with no employee text. Show the conversation as it grows, Scout's question large, its `evidence` line smaller beneath, a progress hint ("question 2 of about 5"). Input depends on `NEXT_PUBLIC_VOICE_MODE`, with a visible switch between typing and speaking: `text` is a text box, `browser` uses speech recognition (`en-GB`) for answers and speech synthesis to read questions aloud. Build the voice layer as `frontend/lib/voice/` with one interface (`listen()`, `speak()`, `stop()`) and one file per mode, so SLNG can be added in task M9 without touching the screen. A "thinking" state covers the wait for make.com. When `done` is true, show the closing line and move to the summary, polling until the check in status is `summarised` (60 second timeout with a friendly message).
- `/check-in/[id]/summary`: title "Your last working day: Friday 18 September". The privacy line from rule 12. `AllocationBars` with expected against that day's actual. `summary_text` above it. Each row can be corrected in steps of 15 minutes, and the total must stay at the working day or the Submit button explains why it is disabled. The evidence for each row is one click away. Submit calls the submit function, then shows "Sent to Tomas for approval".

### M7. Manager screens (60 minutes)
Branch `marcus/m7-manager`.
- `/manager/roles`: one card per role: the document name with a link, when Scout last read it, the proposed split as editable whole numbers with the AI's one sentence reasoning per topic, a running total that must equal 100, and Approve. A button "Read the role documents again" calls the roles sync function. Approved roles show who approved and when.
- `/manager/approvals`: submitted days waiting for approval, grouped by person. Each opens to the same `AllocationBars`, with a mark on rows the employee corrected. Approve, or Return with a comment. A Daily and Weekly switch: weekly shows the person's week as one set of bars and approves all its submitted days together.
- `/manager/suggestions`: a button "Review the last three weeks" calls the suggest function. Ranked cards: title, people affected, team hours per week, annual cost, the four scores with their names spelt out, reasoning, proposed steps as a numbered flow. Approve or Not now. Approve shows "Scout is drafting this in make.com", then a panel with "Open the draft in make.com". Above the cards, a team `AllocationBars` for the period, so the manager sees where the suggestions come from.

### M8. Real data (30 minutes, as soon as Gerson's webhooks exist)
Branch `marcus/m8-real-data`. Marcus puts real values in `frontend/.env.local`. Set `NEXT_PUBLIC_USE_FIXTURES=false`. Only `frontend/lib/data.ts` and `frontend/lib/make.ts` should need changes. Run the whole story twice. Fixtures mode must still work: it is the safety net for the live demo.

### M9. SLNG voice (time boxed to 45 minutes, first thing to cut)
Only start if tasks M6 to M8 are merged before 22:00, or on Sunday before 09:45. Marcus gets an SLNG key from the SLNG team at the event. Read `https://docs.slng.ai/llms.txt`. Add `frontend/lib/voice/slng.ts` plus server routes `/api/voice/transcribe` and `/api/voice/speak` that hold the key. If it is not working after 45 minutes, stop, leave `browser` as the default and say so.

### M10. Pitch outline (Marcus writes, you assist, 20 minutes)
`docs/pitch_outline.md`, three minutes spoken: the problem, the brief in make.com's words, the demo story, what is ours (expected splits from job descriptions, an interviewer that knows what it does not know, suggestions from approved history), the privacy guard rail, the roadmap.

### Checkpoint two, 22:30
Feature freeze. List what works. Remove anything unfinished from the navigation.

---

## Sunday 20 September

### M11. Polish (09:00 to 10:00)
Only the existing screens. Wording, spacing, loading and error states. If time allows and only then: `/me`, the employee's own history as a list of days with their status.

### M12. DEFENCE.md (10:00 to 10:30)
From Gerson's Quality Clouds Norma scanner results. Three sections, one line per item: `## Fixed` ("Fixed: [rule] in [file]"), `## Left` ("Left: [rule] in [file]"), `## Why` (one sentence each, including the choice of personal links without passwords).

### M13. Backup video and submission (10:30 to 11:30)
Shot list for a two minute recording of the story, and the submission form text. No code commits after 10:30.

---

## If something goes wrong
- Speech recognition fails in the room: switch to typing. Paste from `data/interview_script.md`.
- make.com is slow or down in the demo: set `NEXT_PUBLIC_USE_FIXTURES=true`. Tell the judges honestly which part is live.
- Blocked on Gerson: keep building against fixtures. Never wait idle.
