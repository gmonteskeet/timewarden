# BUILD_MARCUS.md: interface, demo data and prompts

You are the coding agent working for Marcus on the Workflow Scout hackathon build. Marcus is the product owner and is not a programmer. Explain what you are doing in plain English, keep questions to him short, and never ask him to make a technical decision without giving a recommendation.

**Before anything else:** read `AGENTS.md` at the repository root. Its rules and data contract override anything here. Work through the tasks below in order. One task, one branch, one pull request. After each task, run its checks, tick it here, and report to Marcus in three lines.

You own: `frontend/`, `data/`, `prompts/`, `docs/`. Do not edit `supabase/`, `make/` or `scripts/`.

Time boxes are in Madrid time, Saturday 19 September unless stated. If a task runs more than 30 minutes over, stop and tell Marcus so he can cut scope.

---

## Phase 1: thin path (finish by 18:30)

### M1. Demo company data (30 minutes) [done]
Branch `marcus/m1-demo-data`. Create these files. Content must be realistic, specific and written in British English.

- `data/company.json`: `{ "name": "Brightline Advisory", "description": "...", "team": "Client Delivery" }`
- `data/people.json`: array of four people with every field of the `people` table in the contract except ids: Elena Ruiz, Tomas Berg, Priya Nair, Jonas Weber. Use a stable `key` field (`elena`, `tomas`, `priya`, `jonas`) and `manager_key` so the seed script can link them. Hourly cost in euros: Elena 85, Tomas 140, Priya 60, Jonas 45.
  - Elena's job description must centre on client work: leading client workshops, building recommendations, managing client relationships, coaching juniors. Her performance criteria (five items) must all be about client outcomes, for example "70 percent of time on client facing work" and "two client proposals supported per quarter". Nothing about reporting. This is what makes the mismatch visible.
- `data/calendar_week.json`: Elena's calendar for 14 to 18 September 2026, about 25 entries, each `{ title, description, start, end, attendees }` with ISO times in Europe/Madrid. It must contain:
  - Genuine client work (workshops, client calls), about 14 hours.
  - Hidden manual reporting, about 11 hours, under bland names: "Weekly status pack" (Monday 09:00 to 11:30), "Status pack: chase inputs" (Tuesday), "Status pack: formatting" (Thursday), "Friday report send out" (Friday 14:00 to 16:30), plus "Timesheet reconciliation".
  - Two vague meetings the agent cannot explain: "Sync" (Tuesday 15:00 to 16:30, two attendees, no description) and "Catch up" (Thursday 11:00 to 12:00, no description).
  - Two clear gaps with nothing booked: Wednesday 13:00 to 17:00 and Friday 09:00 to 11:00.
  - Entries for Priya and Jonas are not needed in the calendar. Their data comes in task M8.
- `data/transcripts/`: three plain text files with a header block (`title`, `occurred_at`, `minutes`, `in_calendar`) then a realistic speaker labelled transcript of 400 to 600 words each:
  1. `2026-09-15_sync.txt`: the Tuesday "Sync". It reveals the meeting was Elena and Jonas manually reconciling numbers from three spreadsheets for the status pack.
  2. `2026-09-16_unplanned_call.txt`: `in_calendar: false`, Wednesday 14:10, 35 minutes. A client rings to ask where last week's report is. Elena says she copies figures by hand from the project tracker into slides each week and it slipped.
  3. `2026-09-17_client_workshop.txt`: a genuine, valuable client workshop, for contrast.
- `data/voice_note_script.md`: what Elena says in her voice note, 60 to 90 seconds when read aloud. She describes her week as "mostly client work, a couple of workshops, some admin". She mentions reporting only in passing ("and the usual Friday report"). She does not mention Wednesday afternoon.
- `data/interview_answers.md`: scripted answers Elena will give to the three expected questions, so the demo is repeatable. The Wednesday gap answer: "I was rebuilding the status pack because the tracker export broke the formatting again."

Checks: all JSON parses (`node -e "JSON.parse(require('fs').readFileSync('data/people.json'))"` for each file). Hours add up as stated. Tell Marcus the total hours per category.

### M2. Calendar file for Google Calendar (15 minutes)
Branch `marcus/m2-calendar-ics`. Write `data/make_ics.mjs`, a small Node script with no dependencies that reads `data/calendar_week.json` and writes `data/elena_week.ics` in valid iCalendar format (timezone Europe/Madrid, one `VEVENT` per entry, attendees as `ATTENDEE` lines with made up `@brightline.example` addresses, `DESCRIPTION` included when present).
Checks: run it, confirm the event count matches the JSON.
**Then stop and give Marcus this one manual step:** "In Google Calendar, create a new calendar called 'Scout demo: Elena Ruiz', then Settings, Import and export, import `data/elena_week.ics` into that calendar. Share the calendar's ID with Gerson." Wait for him to confirm.

### M3. Prompts (45 minutes)
Branch `marcus/m3-prompts`. These are the instructions Claude will follow inside make.com. Gerson pastes them into his scenarios, so each file must be complete and standalone. Every prompt must: state the role, list the inputs by exact name, demand JSON only as output, give the exact JSON shape using the contract's field names, and include one worked example.

- `prompts/01_extract_said_activities.md`: input `transcript_text` and `job_description`. Output: array of `{ title, description, minutes, category }` for what the person *said* they did. If no duration is given, estimate and mark `"estimated": true`.
- `prompts/02_interview_questions.md`: input `calendar_activities`, `transcript_summaries`, `said_activities`, `job_description`. Output: three to five questions, `{ kind, question, evidence }`. Rules: at least one of each kind (`unexplained_meeting`, `calendar_gap`, `mismatch`) when the data supports it. A calendar gap is any unbooked stretch of two hours or more between 09:00 and 18:00 on a working day. An unexplained meeting has no description and a title that gives no purpose. Questions must be specific, quote the day, time and duration, be friendly and never accusatory, and be one sentence each.
- `prompts/03_categorise_and_find.md`: input all activities from all three sources plus interview answers, `job_description`, `performance_criteria`. Output: `findings` array with `category`, `said_minutes`, `seen_minutes`, `in_job_description`, `summary`. Categories are short plain names such as "Client workshops", "Manual status reporting", "Internal meetings". Count each real hour once: when a calendar entry and a transcript describe the same event, do not double count.
- `prompts/04_score_candidates.md`: input `findings`, `hourly_cost_eur`, `performance_criteria`. Output: `candidates` array with every candidate field in the contract except ids, rank and status. Scores 1 to 5 with the meaning of each number spelt out. `annual_cost_eur = hours_per_week * 46 * hourly_cost_eur`. `reasoning` is two plain sentences a manager would understand. `proposed_steps` lists three to six steps naming real make.com apps (for example Google Sheets, Google Slides, Gmail, Slack, Anthropic Claude). Only activities that are repetitive and rule based become candidates. Client workshops must never be proposed.
- `prompts/05_draft_workflow_fill.md`: input one approved candidate and Gerson's template description. Output: the values to fill into the template: `scenario_name`, `schedule` (day and time), `source_sheet_name`, `recipients`, `summary_prompt`. Keep this small on purpose.
- `prompts/README.md`: one paragraph per prompt saying which make.com scenario uses it.

Checks: every prompt has role, inputs, output shape, rules, one worked example using Elena's data. Field names match `AGENTS.md` exactly. Tell Marcus to send Gerson the pull request link as soon as it merges, because Gerson's scenarios wait on these.

### M4. Interface skeleton on fake data (75 minutes)
Branch `marcus/m4-interface-skeleton`. If `frontend/` does not exist yet, ask Marcus to check with Gerson before creating it (Gerson's task G1 creates it). Build with Next.js App Router, TypeScript, Tailwind.

- `frontend/lib/contract.ts`: TypeScript types for every table and webhook body in `AGENTS.md`. This file is shared, so after creating it do not change field names without both humans agreeing.
- `frontend/lib/fixtures.ts`: fake data in the contract shape for Elena's week: 3 questions, 6 findings, 4 candidates. Used when `NEXT_PUBLIC_USE_FIXTURES=true`.
- `frontend/lib/data.ts`: one function per read (`getPerson`, `getQuestions`, `getFindings`, `getCandidates`, `getTeamRollup`). Each returns fixtures or queries Supabase depending on the flag. Screens only ever call these functions, so switching to real data in task M6 touches this one file.
- `frontend/app/api/voice/route.ts`, `answer/route.ts`, `verdict/route.ts`, `decision/route.ts`: server routes that validate the body, add the `x-scout-key` header and forward to the matching make.com webhook. In fixtures mode they return a canned success after a one second delay.
- Screens:
  1. `/` Home: two cards, "I am Elena (employee)" and "I am Tomas (manager)". No login. State this plainly on screen as a demo shortcut.
  2. `/employee/check-in`: big record button using the browser's speech recognition (`window.SpeechRecognition || window.webkitSpeechRecognition`, language `en-GB`, continuous, interim results shown live). A typed fallback box is always visible under "Prefer to type?". On submit, call `/api/voice`, show "Scout is comparing this with your calendar and calls", then show the interview questions one at a time, each with its `evidence` line in smaller text, an answer box with the same record button, and a progress count. When the last answer is sent, link to the said versus seen screen.
  3. `/employee/said-vs-seen`: title "What you said versus what Scout saw". One row per finding: category, two horizontal bars (said hours, seen hours) on the same scale, a tag "In your job description" or "Outside your job description", the summary, and buttons Agree and Disagree. Disagree opens a comment box "Tell us where we got it wrong". A clear note at the top: "This view is for finding work to automate, not for judging you. Your manager sees it only after you have reviewed it."
  4. `/manager/candidates`: ranked cards. Each shows rank, title, hours per week, annual cost in euros, the four scores as small labelled bars with the names spelt out (Time cost, Repetitiveness, Reliability risk, Distance from role), the reasoning, and the proposed steps as a simple numbered flow. Buttons: Approve, Not now. Approve calls `/api/decision`, shows a progress state "Scout is drafting this in make.com", then a success panel with a button "Open the draft in make.com" using `make_scenario_url`.
  5. `/manager/team` (build last, first to cut): hours by category for the four people and the team total, split into "in role" and "outside role".
- Look and feel: clean, calm, professional. One accent colour. Large readable type, because it will be shown on a projector. Works at 1280 pixels wide. No dark mode needed.

Checks: `npm run lint && npm run build` pass. With `NEXT_PUBLIC_USE_FIXTURES=true`, walk the whole story from Home to the success panel without errors. Send Marcus a screenshot of each screen.

### Checkpoint one, 18:30
Tell Marcus: "Ready for checkpoint one. The interface runs the whole story on fake data. Waiting on Gerson for real webhooks."

---

## Phase 2: real wiring (18:30 to 22:30)

### M5. Seed data hand over (15 minutes)
Confirm with Gerson that his seed script reads `data/people.json`, `data/calendar_week.json` and `data/transcripts/`. If he needs a different shape, change the data files, not his script.

### M6. Switch to real data (60 minutes)
Branch `marcus/m6-real-data`. Marcus will put real values in `frontend/.env.local` (he gets them from Gerson, never through GitHub). Set `NEXT_PUBLIC_USE_FIXTURES=false`. Implement the Supabase queries in `frontend/lib/data.ts` only. Add polling every three seconds on the check in screen (for questions to appear) and on the candidates screen (for `make_scenario_url` to appear), with a 60 second timeout and a friendly message if it runs out.
Checks: full story against the real back end, twice. Fixtures mode must still work, because it is the safety net for the live demo.

### M7. Employee correction flow (30 minutes)
Branch `marcus/m7-corrections`. On said versus seen, Disagree plus comment is saved through `/api/verdict` and shown back as "You corrected this". The manager's candidates screen shows a small line "Elena reviewed these findings and corrected 1" so the judges see the employee came first.

### M8. Team roll up (45 minutes, second item to cut)
Branch `marcus/m8-team-rollup`. Add `data/team_findings.json` with ready made findings for Tomas, Priya and Jonas (no calendar needed). Ask Gerson to load it with his seed script. Finish `/manager/team`.

### M9. Pitch outline (Marcus writes, you assist) (30 minutes)
Create `docs/pitch_outline.md`, three minutes spoken: the problem (companies do not know what to automate next), the brief in make.com's own words, the demo story, what is ours (ranking by distance from the job, sources that check each other, an interviewer that knows what it does not know), the privacy guard rail (employee reviews first), the roadmap (email, messages, screen activity, savings tracking).

### Checkpoint two, 22:30
Feature freeze. List for Marcus what works and what does not. Anything not working is removed from the demo path and the navigation.

---

## Phase 3 and 4: Sunday 20 September

### M10. Polish (09:00 to 10:00)
Only the five screens. Fix spacing, wording, loading and error states. No new features. Run the story twice from a clean database (ask Gerson to reset).

### M11. DEFENCE.md (10:00 to 10:30)
Gerson runs the Quality Clouds Norma scanner and gives you the results. Write `DEFENCE.md` at the repository root with exactly three sections, one line per item:
- `## Fixed` lines in the form "Fixed: [rule] in [file]"
- `## Left` lines in the form "Left: [rule] in [file]"
- `## Why` one sentence per item left, including the public read policy on made up data.

### M12. Backup video and submission (10:30 to 11:30)
Help Marcus with a shot list for a two minute screen recording of the story, and with the submission form text (150 word description, the make.com fit, links). Code is frozen from 10:30. Do not commit code after that, only documents.

---

## If something goes wrong
- Speech recognition fails in the room (noise, browser): the typed fallback is the plan. Paste from `data/voice_note_script.md`.
- make.com webhook is slow or down during the demo: set `NEXT_PUBLIC_USE_FIXTURES=true` and redeploy, or run locally. Tell the judges honestly which part is live.
- You are blocked on Gerson: keep building against fixtures. Never wait idle.
