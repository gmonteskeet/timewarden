# Sunday run sheet

Sunday 20 September 2026. All times are Madrid time. Judging opens at 12:00 and we submit at 11:30, so every time below is a time to be finished by, not a time to start.

Marcus owns the interface, the documents, the pitch and the submission. Gerson owns the database, the make.com scenarios and the deployment. Five minute stand up at 09:00, 10:00 and 11:00: what is done, what is blocked, is the demo story still whole.

The one rule for the morning: if something is not working by the time its slot ends, it leaves the demo and joins the roadmap. We say so honestly to the judges rather than trying to fix it on stage.

## 08:00 to 08:30, live test, the whole story once

Both, together, on the live database and live make.com.

1. Run `node --env-file=frontend/.env.local scripts/reset_demo.mjs` (see `docs/reset_the_demo.md`) and delete any draft scenarios left in the make.com account from last night.
2. Run the morning routine so Elena's check in for Friday 18 September exists and her email has been sent.
3. Walk the whole story: Tomas approves a role split, Elena takes the interview, corrects one row and submits, Tomas approves the day, reviews three weeks and approves the top suggestion, and the draft scenario opens in make.com.
4. Write down every break, with the time it happened and the scenario it happened in. Fix nothing yet.

## What the Sunday morning run actually proved (written 08:30)

Run end to end on the live database and the live scenarios, through the interface's own server routes. Twenty of twenty one steps passed at 08:30, and the twenty first passed at 07:54 once the make.com API token was in the account.

| Step | Where it runs | Measured |
|---|---|---|
| The manager approves a role's split, two numbers changed | make.com, Scout 2 | 1.3 seconds |
| Scout's first question | make.com, Scout 4 | 5.8 seconds |
| Later interview turns | make.com, Scout 4 | 2.6 to 4.0 seconds |
| The day summary appears | make.com, Scout 5 | 11 seconds after the interview closed |
| The employee submits with a correction | the Next.js server | 0.7 seconds |
| The manager approves the day | the Next.js server | 0.3 seconds |
| Three weeks reviewed and ranked | make.com, Scout 7 | 19 seconds, two suggestions |
| The decision on the top suggestion | make.com, Scout 8 | 3 seconds |

The summary was 480 minutes exactly, with manual status reporting at 230, and the review ranked "Weekly client status report" first.

**The step that did not pass at 08:30, and passes now:** creating the draft scenario in make.com from inside Scout 8. It needed a make.com API token that was not in the account. Marcus added it himself with `scripts/set_scout8_token.mjs` at 07:51. Scout 8 ran end to end at 07:54, took 3.4 seconds, and a real draft scenario appeared in the folder `Workflow Scout drafts`. Approving a suggestion now creates a real draft scenario in make.com, switched off, for a person to finish.

**Cut, and said so plainly:** reading the role documents live from Google Drive (the seed script loads them), the morning email (the link is opened by hand), and SLNG voice (typing and the browser's own voice are in).

## 08:30 to 09:15, fix and run it again

Gerson fixes only what broke the story, worst first. Marcus keeps out of the way and works on the pitch.

Finish with a second clean run, end to end, with no hands on the database in between. This is the run that decides what we claim is live.

**Decision point at 09:15.** Whatever is still broken now is cut and moves to the roadmap. Set `NEXT_PUBLIC_USE_FIXTURES=true` as the demo fallback if the second run did not hold.

## 09:15 to 09:45, deployment

Gerson. Deploy the interface to Vercel with the live environment variables. Open the deployed address in a private browser window and check:

- the home page loads and the footer says which mode it is running in,
- a personal link from the morning email signs the right person in,
- one interview turn comes back from make.com within 12 seconds,
- signing in as Tomas shows only his own team.

Marcus checks the same four things on his phone, on the venue network, not on the hotel wifi.

## 09:45 to 10:15, the two sponsor tests

STATUS: which two tests count for the sponsor prizes is to be confirmed by Marcus with the organisers before the code freeze.

1. **Quality Clouds Norma.** Gerson runs the scanner (`norma.qualityclouds.com` or the Norma MCP server) over the repository, fixes at least one real issue, and hands Marcus the fixed and left lists with file names. Marcus puts them straight into `DEFENCE.md`, whose "Why" section is already written.
2. **SLNG voice.** Only if Marcus has a key from the SLNG team at the event and the browser voice mode is already solid. Time boxed to 20 minutes: if it is not working, leave `browser` as the voice mode and say so in the README.

## 09:45 to 10:15, polish, in parallel

Marcus, on the interface only, no new features. Anything found during the two live runs: wording, spacing, a waiting state that does not say what Scout is doing, an error without a Try again. `npm run lint` and `npm run build` must pass before every merge.

## After the freeze, waiting for review

- **An employee can add time to a topic Scout recorded nothing for.** On the summary page a role topic with no minutes now gets the same minus and plus buttons as any other row, and the server creates the allocation row on submit. Marcus found this on the live site and chose the full fix. It is on the branch `marcus/s9-add-time-to-empty-topic` and waits for the development manager to read it line by line: it touches the submit path the judges watch, so it is not merged or deployed.

## 10:15 to 10:30, secrets sweep and freeze

Gerson searches the repository, its history and every exported blueprint for keys, tokens, webhook addresses and personal access tokens. Marcus reads the README and `DEFENCE.md` one last time for anything that claims something works live when it has not been tested live.

**10:30, code freeze.** No commits to `main` after this, for any reason. If the demo breaks after 10:30 we demo the previous version and say so.

## 10:30 to 11:15, video, README and submission

- Marcus records the two minute backup video from the shot list in `docs/submission_text.md`, in sample data mode so it cannot fail on the network. One take, no editing beyond trimming the ends.
- Gerson finishes the README status lines with what the 08:30 run actually proved, then makes the repository public and checks it opens in a private browser window.
- Marcus fills in the submission form from `docs/submission_text.md`: the 150 word description, the 50 word version, the make.com paragraph, the repository link, the deployed address and the video.

## 11:15 to 11:30, rehearse twice

Both, timed, out loud, standing up. Marcus presents from `docs/pitch_outline.md`, Gerson drives the screen.

- First run: full length, find the sentences that do not land and the clicks that are slow.
- Second run: cut it to time. Three minutes spoken. Stop at three minutes whether or not it is finished, and cut from the middle, never from the ending.

Agree the two sentences we use if make.com is slow in the room, and who says them.

**11:30, submit.** Do not keep polishing the form after this.

## After submission

- Reset before each judging round at 14:00 and 16:00: `node --env-file=frontend/.env.local scripts/reset_demo.mjs`, delete old draft scenarios, run the morning routine once so a fresh email is waiting.
- Keep make.com and the deployment running until 18:00.
- Nobody touches `main` between rounds.
