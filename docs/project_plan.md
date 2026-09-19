# Project plan: the timetable for humans (version 2)

Rewritten Saturday 19 September 2026 at 17:00 after the make.com mentor session. Task details are in `docs/BUILD_MARCUS.md` and `docs/BUILD_GERSON.md`. Rules and the data contract are in `AGENTS.md`, which wins any disagreement. `docs/CHANGES_V2.md` explains what changed.

Deadline: Sunday 20 September 2026, 12:00 midday. We submit at 11:30.

## Honest position
Version 2 is more to build than version 1 and we have about five and a half working hours tonight and two and a half tomorrow. The plan works only if the two of you build in parallel against the contract and use the cut order early. The interview and the summary come first on both sides, because they are what the brief asks for.

## Saturday
| Time | Marcus | Gerson |
|---|---|---|
| 17:00 to 17:15 | Both: read `docs/CHANGES_V2.md` and `AGENTS.md` sections 5 and 6 together. Agree them or change them now. Merge the open task M1 pull request. | |
| 17:15 to 18:15 | Task M2, demo data version 2 (role documents, Friday call transcript, interview script, history script). Task M3, calendar file, then by hand: import the calendar, upload the role documents, send Gerson the calendar ID and folder link. | Task G4, migration to the version 2 tables. Task G5, connections and scenario map. Task G6, seed script. |
| 18:15 to 19:00 | Task M4, the five prompts. Send Gerson the link the moment it merges. | Task G7, the interview turn and day summary scenarios. |
| 19:00 to 20:00 | Task M5, interface foundations on fake data, including the one standard summary component. | Task G7 continued, then task G8, the morning run. |
| 20:00 | Checkpoint one, together, then a short dinner. Fake data runs the whole story in the interface. One real interview turn goes from the interface to make.com and back. Decide cuts. | |
| 20:30 to 22:30 | Task M6, interview and summary screens. Task M7, manager screens. Task M8, real data. | Task G9, role documents and split approval. Task G10, submit and approval. Task G11, suggestions. Task G12, decision and draft creation. Task G14, deploy. |
| 22:30 | Checkpoint two, together: feature freeze. Anything not working leaves the demo and joins the roadmap slide. Write `docs/sunday.md`. Doors close at 23:00. | |

Only if ahead: Marcus task M9 (SLNG voice, 45 minutes at most) and task M10 (pitch outline). Gerson task G13 (the agent that calls the scenarios).

## Sunday
| Time | Marcus | Gerson |
|---|---|---|
| 09:00 to 10:30 | Task M11, polish. Task M12, `DEFENCE.md`. Pitch outline if not done. | Task G15, two clean runs. Task G16, Quality Clouds Norma scanner and one fix. Task G17, secrets sweep. |
| 10:30 | Code freeze. | |
| 10:30 to 11:30 | Task M13, backup video and submission form. | Task G18, README and make the repository public. |
| 11:15 | Rehearse twice, timed. Marcus presents, Gerson drives. | |
| 11:30 | Submit. | |
| 14:00 and 16:00 | Judging rounds. Before each: reset the database, delete old drafts, run the morning routine so a fresh email is waiting. Keep everything running until 18:00. | |

## Things only the humans can do
- Marcus: get an SLNG key from the SLNG team at the event, only if task M9 is going ahead.
- Marcus: choose the inbox that will receive Elena's morning email on stage.
- Marcus: ask the organisers for the submission format and pitch length.
- Gerson: decide whether submit and day approval run through make.com or straight from the server (task G10), and tell Marcus.
- Both: a five minute stand up every 90 minutes. What merged, what is blocked, is the demo story still intact.
