# Project plan: the timeline for humans

This is the overview for Marcus and Gerson. The detailed, task by task instructions for the coding agents are in `docs/BUILD_MARCUS.md` and `docs/BUILD_GERSON.md`. The rules and the data contract are in `AGENTS.md`. If anything here disagrees with `AGENTS.md`, `AGENTS.md` wins.

Deadline: Sunday 20 September 2026, 12:00 midday. We submit at 11:30.

## The demo story (everything serves this)
Elena Ruiz at the made up firm Brightline Advisory is paid to do client work. Her calendar and call transcripts show many hours of manual weekly reporting. She leaves a voice note. The agent asks three sharp questions (one unexplained meeting, one calendar gap, one mismatch). She reviews her "said versus seen" view and corrects one item. Her manager sees the ranked automation ideas, approves the top one, and a real draft workflow appears in make.com.

## Build shape
- make.com holds the agent logic: one agent that calls smaller scenarios (calendar intake, transcript intake, voice intake and interview, scoring, draft workflow creation), plus the human approval step.
- Supabase holds the data.
- A Next.js web interface records the voice note and shows the interview questions, the "said versus seen" view, the ranked list and the approve button. It talks to make.com through webhooks (web addresses that make.com listens on).

## Saturday
| Time | Marcus | Gerson |
|---|---|---|
| Now to 15:30 | Confirm the make.com account has the agent feature and an API token. Ask the make.com mentor for judging criteria and prize. Find out the submission format. Read and agree `AGENTS.md` section 5 and 6 with Gerson. | Tasks G1 to G3: interface skeleton, Supabase project and tables, make.com connections and secrets. |
| 15:30 to 18:30 | Tasks M1 to M4: demo company data, calendar file, prompts, interface on fake data. | Tasks G4 to G10: seed script, make.com scenarios for calendar, transcripts, voice and interview, scoring, verdicts, and the agent. |
| 18:30 | Checkpoint one, together: voice note in, ranked list out. Ugly is fine. Nothing new starts until this runs. | |
| 18:30 to 22:30 (dinner 20:00) | Tasks M5 to M9: real data wiring, employee correction flow, team roll up, pitch outline. | Tasks G11 to G14: draft workflow template, approval and draft creation, deployment. |
| 22:30 | Checkpoint two, together: feature freeze. Whatever does not work is cut and moved to "roadmap" in the pitch. Write Sunday's list in `docs/sunday.md`. | |

## Sunday
| Time | Marcus | Gerson |
|---|---|---|
| 09:00 to 10:30 | Tasks M10 and M11: polish the five screens, write `DEFENCE.md`. | Tasks G15 to G17: two clean runs, Quality Clouds Norma scanner and one fix, secrets sweep. |
| 10:30 | Code freeze. | |
| 10:30 to 11:30 | Task M12: backup demo video, submission form. | Tasks G18 and G19: README, exported make.com blueprints. |
| 11:15 | Rehearse the pitch twice, timed. Marcus presents, Gerson drives the demo. | |
| 11:30 | Submit. | |
| 14:00 and 16:00 | First round judging, then top 10 demos. Keep make.com and the interface running until 18:00. | |

## Standing rules
- Stand up every 90 minutes, five minutes: what merged, what is blocked, is the demo story still intact.
- One task, one branch, one pull request. Merge small and often. The main version must always run.
- No previous work is copied in. Everything in the repository is written this weekend.
- Cut order: transcript intake first, team roll up second. Never cut: voice note, interview questions, human approval, real draft workflow in make.com.
