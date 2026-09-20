# Workflow Scout

Workflow Scout finds the work a company should hand over to make.com, starting from each person's own account of their working day. It asks every person what they actually did, compares that with what their role is for, and turns the gap into a ranked list of workflows a manager can approve, which then become real draft scenarios in make.com.

Built for the make.com challenge at HackBarna 2026, Barcelona, 19 and 20 September 2026, by Marcus Rodrigues and Gerson Monteskeet.

## The demo in five steps

1. **Roles.** Tomas Berg runs Client Delivery at Brightline Advisory. Scout has read one document per role from the company's document store and proposes how each role's time should divide across its topics. Tomas adjusts one number and approves.
2. **The check in.** Elena Ruiz, a Senior Client Consultant, gets a personal link in her morning email. Scout interviews her about her last working day. It already has her calendar and her recorded calls, so it asks only about what it cannot explain: two empty hours on Friday morning, and a block called "Friday report send out".
3. **The summary.** Elena sees one bar per topic: what her role expects against what the day actually held. Nearly four hours went to manual status reporting, which is nowhere in her role. She corrects one number and submits. Nothing reaches her manager until she does.
4. **Approval.** Tomas approves Elena's day, then asks Scout to review three weeks of approved days for the team. Scout ranks "Weekly client status report" first: about seven hours a week across three people.
5. **The draft.** Tomas approves that suggestion and a real draft scenario appears in the make.com account, ready for a person to check.

## How it answers make.com's brief

| The brief asks for | Where it is in Workflow Scout |
|---|---|
| A daily voice or text check in | The check in screen. Type or speak, same questions either way, and the switch is on screen. |
| Structured interview questions | make.com asks the questions, from the calendar and call gaps it cannot explain. It stops itself, normally within six. |
| Continuous capture | A make.com scenario runs every weekday morning: it reads calendars and call transcripts, creates the day's check in and emails each person their link. |
| Prioritisation | Every candidate workflow is scored on time cost, how repetitive it is, reliability risk and how far the work sits from the person's role. The weighting is fixed and computed in make.com, never by the model. |
| Human approval | Three approvals, all by a person: the manager approves each role's expected split, the employee submits their own day, the manager approves the day and then the suggestion. |
| A real draft scenario | Approving a suggestion calls the make.com API and creates a draft scenario in the account, with a link straight to it. |

## How the parts talk to each other

```
Browser  --only ever talks to-->  Next.js server (pages and /api routes)
Next.js server  --reads and writes-->  Supabase, using the service key, filtered by who is signed in
Next.js server  --POST with x-scout-key-->  make.com webhooks
make.com scenarios  --read and write-->  Supabase (service key held in make.com)
make.com  --reads-->  document store, Google Calendar      make.com  --sends-->  morning emails
make.com draft creation scenario  --POST-->  make.com API (creates the draft scenario)
```

The browser never holds a database key, a webhook address or a voice key. There is no public read access to the database.

## What is live and what is sample data

**Live at https://workflow-scout.vercel.app**, on the real database and the real make.com scenarios. Run end to end on Sunday morning, 20 September, through the interface's own server routes. Measured timings from that run:

| Step | Runs in | Measured |
|---|---|---|
| The manager approves a role's expected split | make.com, Scout 2 | 1.3 seconds |
| One interview turn | make.com, Scout 4 | 2.6 to 5.8 seconds, against a 12 second budget |
| The day summary | make.com, Scout 5 | ready 11 seconds after the interview closed |
| Three weeks reviewed and ranked | make.com, Scout 7 | 19 seconds, two suggestions |
| The decision on a suggestion | make.com, Scout 8 | 3 seconds |
| The employee submits, the manager approves the day | the Next.js server, straight to the database | under a second |

For Elena's Friday the summary came out as 480 minutes exactly: manual status reporting 230, internal meetings and administration 90, client delivery and workshops 60, coaching juniors 60, client relationships 40. The review then ranked "Weekly client status report", from that same label, first.

Submit and day approval are written by the server rather than by a scenario. `AGENTS.md` section 6 allows either, and the scenario for them was never built.

Three things changed after that run and are live as well. An employee can now add time to a role topic Scout recorded nothing for, and the row they add is marked as their own correction; this was proved against the real database through the interface's own routes. In the interview, Enter starts a new line so a long answer can be written in paragraphs, and Send sends it. Approving a role's split now shows its confirmation on live data.

Galtea was used to evaluate the interview turn, the heart of the product, over 22 hand written cases covering prompt injection, privacy and ordinary replies. It scored Claude's raw replies to the interview prompt through a local agent, not the live scenarios: 8 of the 22 cases had at least one metric below the pass mark, and a deterministic check found 7 of the 22 raw replies wrapped in a markdown code fence. **That code fence never reaches a real user.** Scout 4, Scout 5 and Scout 7 each pick the reply out by block type and strip any fence before parsing it, on the first route and on the retry, which was confirmed again on Sunday with a full live interview as Elena. The prompt rule "never a code fence" is a second line of defence behind that, not the thing holding the demo up. The failures that would reach a real user are the other ones: Scout deflects rather than refuses plainly when asked about a colleague's day, and it repeats its previous question word for word when asked to reveal its instructions. Those are fixed in `prompts/02_interview_turn.md` in this repository and have not been pasted into make.com. `docs/galtea_findings.md` has the numbers and the detail.

Approving a suggestion creates a real draft scenario in make.com, switched off, for a person to finish.

**Cut, and we say so plainly:**

- **Reading the role documents live from Google Drive.** The four role documents are loaded by the seed script instead. The scenario that reads them needs a person to connect Google Drive in the make.com editor.
- **The morning email.** The check in link is opened by hand in the demo. The scenario that sends it is not built.
- **SLNG voice.** Typing and the browser's own voice are in. The SLNG upgrade was first in the cut order and was not started.

The interface runs in two modes, and the footer of every page says which one you are looking at.

- **Sample data mode** (`NEXT_PUBLIC_USE_FIXTURES=true`) runs the whole story on the made up company in `frontend/lib/fixtures.ts`, with no database and no make.com. This is what the three commands below give you, and it is the safety net for the live demo.
- **Live mode** (`NEXT_PUBLIC_USE_FIXTURES=false`) reads and writes Supabase and calls the make.com scenarios for the interview, the role splits, the suggestions and the draft creation.

We do not claim a part works live until we have run it live. Everything in the table above was run live on Sunday morning.

## Running it locally on sample data

```
git clone https://github.com/gmonteskeet/workflow-scout.git && cd workflow-scout/frontend
npm install
NEXT_PUBLIC_USE_FIXTURES=true npm run dev
```

Open http://localhost:3000 and choose a person under "Demo sign in". No keys, no database and no make.com account are needed. Screenshots of every screen are in `docs/screenshots/`.

## Honest notes

- **No passwords, by design.** Every person has a secret link that arrives in their morning email. Opening it sets a signed, http only session cookie. The home page offers the same thing as a labelled demo sign in so judges can look around. Rights are checked on the server on every request: an employee can only ever see their own days, a manager only the people who report to them.
- **The company and the people are made up.** Brightline Advisory, Tomas, Elena, Priya and Jonas, their clients and their calls were all written for this hackathon. No real company data is in this repository.
- **One draft template.** Approving a suggestion creates one real draft scenario in make.com from one template shape. It is a genuine draft in the account, not a picture of one, but it is not yet a different shape per suggestion.
- **No secrets in this repository.** `.env.example` lists variable names only. Real keys live in `frontend/.env.local` and inside make.com connections.
- **Everything here was written over the weekend of 19 and 20 September 2026.** Nothing was carried in from an earlier project.

## Sponsors' tools used

- **make.com**: the agent itself. Six scenarios, all live: the interview turn, the day summary, the split approval, the three week review and ranking, the decision on a suggestion, and the draft template.
- **Anthropic Claude**, called through the Anthropic Claude app inside make.com, model `claude-sonnet-4-5`. Every prompt is a file in `prompts/`, pasted into the scenario that uses it.
- **Entered:** the make.com track, the Quality Clouds Production Ready challenge (Norma scan, one fix, `DEFENCE.md`) and the Galtea challenge (evaluation of the interview, findings in `docs/galtea_findings.md`).

## Where to look in the code

- `frontend/` Next.js App Router, TypeScript, Tailwind CSS. `app/` holds the five screens, `components/` the shared interface pieces, `lib/` the data contract, the session and the sample data.
- `make/specs/` one build sheet per make.com scenario, `make/blueprints/` the exported blueprints.
- `supabase/migrations/` the database schema. `scripts/` the seed and reset scripts.
- `prompts/` the prompts the scenarios give to the model. `data/` the made up role documents, calendar and call transcripts.
- `AGENTS.md` the shared rules and the full data contract. `docs/pitch_outline.md` the pitch, `docs/submission_text.md` the submission copy, `DEFENCE.md` what the code scanner found.
