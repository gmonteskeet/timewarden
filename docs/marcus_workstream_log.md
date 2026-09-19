# Marcus workstream log

This file is the running record of Marcus's side of the Workflow Scout build. A new session must be able to pick up from this file alone. The development manager (Claude in Cowork) updates it after every task. The task list itself is in `docs/BUILD_MARCUS.md`. The rules and the data contract are in `AGENTS.md`.

## How the work runs
1. The development manager writes one prompt per task. Marcus pastes it into Claude Code, which is launched from the repository folder.
2. Claude Code does the whole task on its own branch, opens a pull request, and reports back.
3. The development manager opens the actual files and reviews them against `AGENTS.md` and the task's own checks. Verdict: pass or fix.
4. Nothing merges into `main` without a pass.

## Key times (Madrid), version 2 of the plan
- Saturday 19 September, 20:00: checkpoint one. The interface runs the whole story on fake data, and one real interview turn goes to make.com and back.
- Saturday 19 September, 22:30: checkpoint two, feature freeze. Doors close at 23:00.
- Sunday 20 September, 10:30: code freeze. 11:30: submit. 12:00: deadline.

## Current position
- Last update: Saturday 19 September 2026, 17:55 Madrid (task M5 reviewed, manual Google steps done).
- The plan changed to version 2 at 17:00 after the make.com mentor session. Read `docs/CHANGES_V2.md` first, then `AGENTS.md` and `docs/BUILD_MARCUS.md`.
- In progress: task M6, the check in (interview and summary), in the CLI on branch `marcus/m6-check-in`.
- Against the plan: about two hours ahead. Task M6 was planned to start at 20:00.
- The long CLI prompts are kept outside the repository, in the workspace folder `02_projects/timewarden/cli_prompts/`, because long pastes into the CLI get cut off. Marcus pastes one line telling the CLI to read the file.

## Task record

### Task M0, planning documents and folder skeleton
- Status: done and merged into `main` as pull request 1 (commit `a0f4696`, merge `b4c5e1f`).
- Checked on 19 September at 15:15: `AGENTS.md`, `CLAUDE.md`, `docs/BUILD_MARCUS.md`, `docs/BUILD_GERSON.md`, `docs/one_page_brief.md` and `docs/project_plan.md` are all on `main`. The working folder is clean. Local `main` matches the last known copy of GitHub's `main` (`b4c5e1f`). A live check against GitHub could not be run from the manager's session because it has no GitHub login, so Claude Code confirms this at the start of task M1.
- Next: task M1, the demo company data.

### Task M1, the demo company data (version 1 shape)
- Status: done and merged into `main` as pull request 5 (commit `44f47cf`). It was merged before the manager reviewed it, so it was checked after the merge instead.
- Checked on 19 September at 17:05: all three JSON files parse. 25 calendar entries, no em dashes, no placeholder text, transcripts 527 to 598 words with headers that match the calendar. Friday 18 September has the empty 09:00 to 11:00 slot and the "Friday report send out" from 14:00 to 16:30, which version 2 of the demo story relies on. Friday also has an empty 12:00 to 13:00, which is lunch: the interview prompt in task M4 must not treat it as a gap.
- Verdict: pass.

### Task M1b, version 2 of the plan
- Status: merged into `main` as pull request 6 (commit `cb58aa2`, merge `e77d320`). Replaced `AGENTS.md`, `.env.example`, both build files, the one page brief and the project plan, and added `docs/CHANGES_V2.md`.
- Open point: `AGENTS.md` and `docs/BUILD_GERSON.md` changed without Gerson having seen them. Marcus must tell Gerson before Gerson starts his next task.
- Next: task M2, the version 2 demo data.

### Task M2, the version 2 demo data
- Status: reviewed, pass. Pull request 7, branch `marcus/m2-demo-data-v2`. Marcus to merge.
- Checked in the actual files: five JSON files parse. `data/history.json` has 42 approved check ins, every day totals 480 minutes and 100 percent, no weekends, every topic name matches `data/expected_splits.json`, and the only outside role labels are "Manual status reporting" and "Timesheet reconciliation". Every role split adds up to 100. No em dashes. The role documents mention reporting only on the Business Analyst's line. `data/calendar_week.json` unchanged. Only `data/` and `docs/` touched. No secrets.
- Team average in the history: 6.9 hours a week of manual status reporting, 2.4 hours of timesheet reconciliation.
- To carry forward: `data/interview_script.md` puts Elena's Friday at 230 minutes of manual status reporting (80 minutes fixing last week's pack plus the 150 minute send out). The demo story text in `AGENTS.md` says two and a half hours. The fake data in task M5 must use the 230 minute figure from the script. The interview prompt in task M4 must not treat the 12:00 to 13:00 lunch hour as a gap worth a question unless nothing else is left to ask.
- Next: task M3, the calendar file and the role documents into Google.

### Task M3, the calendar file and the role documents into Google
- Code part: reviewed, pass. Pull request 8, branch `marcus/m3-calendar-ics`. `data/elena_week.ics` has 25 events, a Europe/Madrid timezone block, correct line endings, no line over 75 bytes, no description on "Sync" and "Catch up", and only made up `@brightline.example` addresses.
- Manual steps for Marcus, tick each when done:
  - [x] Step 1: in Google Calendar create the calendar "Scout demo: Elena Ruiz" and import `data/elena_week.ics` into it.
  - [x] Step 2: in Google Drive create the folder "Brightline Advisory role documents" and upload the four files from `data/role_documents/` as Google Docs.
  - [x] Step 3: send Gerson the calendar ID and the Drive folder link by direct message. Never put them in the repository.
- Next: task M4, the prompts.

### Task M4, the prompts
- Status: reviewed, pass. Pull request 10, branch `marcus/m4-prompts`. Marcus to merge and send Gerson the link.
- Checked in the actual files: five prompts and a README. Each has role, inputs, output shape, rules and a worked example, and demands JSON only at the top and the end. No code fences and no em dashes. The interview prompt has the lunch rule, the six question limit and two worked examples built on Elena's Friday. The day summary example totals 480 with 230 minutes of "Manual status reporting". The suggestion prompt never outputs the total score, the rank or the annual cost. Only `prompts/` and `docs/` touched.
- Gerson needs to know: three prompts expect inputs beyond the build file. The suggestion prompt takes `working_days_in_period` and a `sample_evidence` list on each history row. The draft fill prompt takes `contacts`. Each transcript activity carries `in_calendar`. All are listed in `prompts/README.md`.
- Next: task M5, the interface foundations on fake data.

- Manual steps finished at 17:50. The calendar "Scout demo: Elena Ruiz" (25 events) and the Drive folder "Brightline Advisory role documents" (four Google Docs named after the role keys) live in Marcus's personal Google account and are shared with the Google account Gerson's make.com connection uses. The calendar ID and folder link went to Gerson by direct message only.

### Task M5, the interface foundations on fake data
- Status: reviewed, pass. Branch `marcus/m5-interface-foundations`. Marcus to merge.
- Checked in the actual files: `frontend/lib/contract.ts` matches the tables in `AGENTS.md` field for field. The session cookie is signed with HMAC SHA-256, compared in constant time, expires after seven days, and the fallback secret works only in fake data mode. The `next` address after sign in is limited to paths on the site. `frontend/lib/make.ts` is server only, has one function per webhook, adds the `x-scout-key` header and uses a 12 second limit for the interview. No new packages. `frontend/.env.local` is ignored by git. Only `frontend/` and `docs/` touched. No em dashes, no secrets.
- Not checked by the manager: lint and build, because the manager's session cannot run the Mac's installed packages. The CLI's own run is relied on for those.
- To carry forward: four pages still say "This screen is being built today." Task M6 removes it from the check in page and task M7 from the three manager pages.
- Next: task M6, the check in.

## Parked
- Nothing yet.

## Waiting on Gerson
- Gerson to read `docs/CHANGES_V2.md` and agree the new `AGENTS.md`.
- The interview webhook, for the one real interview turn at checkpoint one (20:00).

## Gerson is waiting on Marcus for
- The version 2 data files from task M2 (role documents, `data/people.json`, `data/expected_splits.json`, `data/history.json`, the new Friday transcript). Message him the moment task M2 merges.
- The calendar ID and the Google Drive folder link from task M3, the calendar and role documents into Google.
- The five prompts from task M4. This is the most urgent hand over: his make.com scenarios paste them in.
