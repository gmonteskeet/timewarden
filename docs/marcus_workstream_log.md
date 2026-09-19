# Marcus workstream log

This file is the running record of Marcus's side of the Workflow Scout build. A new session must be able to pick up from this file alone. The development manager (Claude in Cowork) updates it after every task. The task list itself is in `docs/BUILD_MARCUS.md`. The rules and the data contract are in `AGENTS.md`.

## How the work runs
1. The development manager writes one prompt per task. Marcus pastes it into Claude Code, which is launched from the repository folder.
2. Claude Code does the whole task on its own branch, opens a pull request, and reports back.
3. The development manager opens the actual files and reviews them against `AGENTS.md` and the task's own checks. Verdict: pass or fix.
4. Nothing merges into `main` without a pass.

## Key times (Madrid)
- Saturday 19 September, 18:30: checkpoint one, the story runs on fake data.
- Saturday 19 September, 22:30: checkpoint two, feature freeze.
- Sunday 20 September, 10:30: code freeze. 11:30: submit. 12:00: deadline.

## Current position
- Last update: Saturday 19 September 2026, 15:15 Madrid.
- Next task: task M1, the demo company data. Branch `marcus/m1-demo-data`. Waiting for Marcus to say go.
- Against the plan: the plan has tasks M1 to M4 starting at 15:30, so we are on time. The four tasks add up to 2 hours 45 minutes, which leaves about 20 minutes of slack before checkpoint one.

## Task record

### Task M0, planning documents and folder skeleton
- Status: done and merged into `main` as pull request 1 (commit `a0f4696`, merge `b4c5e1f`).
- Checked on 19 September at 15:15: `AGENTS.md`, `CLAUDE.md`, `docs/BUILD_MARCUS.md`, `docs/BUILD_GERSON.md`, `docs/one_page_brief.md` and `docs/project_plan.md` are all on `main`. The working folder is clean. Local `main` matches the last known copy of GitHub's `main` (`b4c5e1f`). A live check against GitHub could not be run from the manager's session because it has no GitHub login, so Claude Code confirms this at the start of task M1.
- Next: task M1, the demo company data.

## Parked
- Nothing yet.

## Waiting on Gerson
- The `frontend/` folder does not exist on `main` yet. Gerson's task G1, the repository skeleton, creates it. Task M4, the interface skeleton, needs it. Marcus to ask Gerson for a time, and to get it before about 16:45.

## Gerson is waiting on Marcus for
- The data files from task M1 (`data/company.json`, `data/people.json`, `data/calendar_week.json`, `data/transcripts/`). His seed script, task G4, reads them.
- The Google Calendar ID from task M2, the calendar file, after Marcus imports the calendar by hand.
- The five prompts from task M3. His make.com scenarios, tasks G7, G8 and G12, paste them in. This is the most urgent hand over.
- `data/team_findings.json` from task M8, the team roll up.
