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
- Last update: Saturday 19 September 2026, 17:10 Madrid (task M2 reviewed).
- The plan changed to version 2 at 17:00 after the make.com mentor session. Read `docs/CHANGES_V2.md` first, then `AGENTS.md` and `docs/BUILD_MARCUS.md`. Task numbers restarted: task M2 is now the version 2 demo data.
- Next task: task M3, the calendar file and the role documents into Google. Branch `marcus/m3-calendar-ics`. The CLI writes the calendar file script, then Marcus does three steps by hand.
- Against the plan: about 45 minutes ahead. Task M2 was planned to end at 17:55 and was reviewed at 17:10.

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

## Parked
- Nothing yet.

## Waiting on Gerson
- Gerson to read `docs/CHANGES_V2.md` and agree the new `AGENTS.md`.
- The interview webhook, for the one real interview turn at checkpoint one (20:00).

## Gerson is waiting on Marcus for
- The version 2 data files from task M2 (role documents, `data/people.json`, `data/expected_splits.json`, `data/history.json`, the new Friday transcript). Message him the moment task M2 merges.
- The calendar ID and the Google Drive folder link from task M3, the calendar and role documents into Google.
- The five prompts from task M4. This is the most urgent hand over: his make.com scenarios paste them in.
