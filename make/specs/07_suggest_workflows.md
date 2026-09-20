# Scout 7: Suggest workflows

Reviews the team's approved days for a period, finds the time that keeps going
to repetitive work outside people's roles, and saves ranked suggestions for the
manager. This is the scenario behind the Suggestions screen, and the step that
turns three weeks of check ins into "Weekly client status report".

**Trigger:** custom webhook, `MAKE_WEBHOOK_SUGGEST`. Nothing else: the weekly
run is task G13's job, not this scenario's.
**Folder:** `Workflow Scout`
**Time limit: 40 seconds for the whole run.** One Claude call with up to 4000
tokens is most of that.

Built by Marcus's assistant through the make.com API on Saturday 19 September,
agreed with Gerson. Read `make/specs/README.md` first for the shared pattern.

## What it does, in order

1. Refuse anything that is not our own interface.
2. In **one** call to the database: roll up the approved days in the period per
   person and label, and get back the user message for Claude already written.
3. If there is nothing to review, say so and stop.
4. Ask Claude for at most four suggestions, with the four scores for each.
5. Read Claude's reply. If it is not valid JSON, ask once more, then give up.
6. In **one** call to the database: work out the cost, the score and the rank
   of each suggestion, replace the company's earlier proposed suggestions, and
   save the new ones.
7. Reply with how many were saved.

It follows scenario four: one database call in, one out. Rolling up hundreds of
allocations and ranking the result with make.com modules would be slow, and
fragile to change. The model scores; the database does every sum.

## The two database calls

Migration `0004_team_history.sql` adds both, plus the view
`public.team_history` (every approved day, per person and label, for checking
numbers by hand in the SQL editor). Only approved check ins count, everywhere.

### `public.scout_suggest_context`

Takes `p_company_id`, `p_period_start`, `p_period_end`. Read only. Gives back:

| Field | What it is |
|---|---|
| `ok` | `false` with a plain `message` when the company does not exist, the period is back to front, or there are no approved days in it |
| `working_days_in_period` | Monday to Friday from start to end, both included |
| `prompt_input` | **the whole user message for Claude, already written as JSON text** |

`prompt_input` holds exactly the six fields `prompts/README.md` lists for
`04_suggest_workflows.md`: `period_start`, `period_end`,
`working_days_in_period`, `team_history` (with `minutes_by_weekday` and up to
three `sample_evidence` lines per row, most recent first), `people` (the people
with approved days in the period, with their hourly cost) and
`roles_and_topics`.

### `public.scout_save_candidates`

Takes `p_company_id`, `p_period_start`, `p_period_end` and `p_candidates`,
which is either Claude's array or the whole `{ "candidates": [...] }`.

1. Deletes the company's candidates with status `proposed`. Anything approved,
   rejected or drafted is left alone.
2. For each suggestion, from the approved minutes on its `source_label` in the
   period:
   - `people_affected`: how many people have minutes on that label
   - `hours_per_week`: the team's total, to one decimal place
   - `annual_cost_eur`: the sum over those people of (their hours per week
     x 46 x their hourly cost), to the nearest euro
   - `total_score`: `0.35 x time + 0.20 x repetitive + 0.15 x reliability +
     0.30 x role distance`, with each score held to a whole number from 1 to 5
   - `rank`: 1 for the highest `total_score`
3. Inserts them with status `proposed`.

The label is matched without regard to case or spaces at the ends. If Claude
names a label that is not in the history at all, its own `people_affected` and
`hours_per_week` are kept and `annual_cost_eur` is 0, so a made up label can
never look expensive.

It gives back `{ ok, candidates_created, titles_in_rank_order }`.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 7 suggest workflows` |
| 2 | HTTP > Make a request | `read the team history` |
| 3 | Flow control > Router | `is there history to review` |
| | **Route A: the team history is there** | |
| 22 | Tools > Set variable | `the suggestion prompt` |
| 4 | Anthropic Claude > Create a message | `suggest workflows` |
| 5 | JSON > Parse JSON | `read Claude's reply` |
| 6 | JSON > Create JSON | `build the save call` |
| 7 | HTTP > Make a request | `rank and save the suggestions` |
| 8 | Flow control > Router | `were they saved` |
| 9 | Webhooks > Webhook response | `answer the interface` |
| 10 | Webhooks > Webhook response | `tell the interface it failed` |
| | **Error route on 5: one retry** | |
| 11 | Anthropic Claude > Create a message | `suggest workflows again, JSON only` |
| 12 | JSON > Parse JSON | `read the second reply` |
| 13 | Webhooks > Webhook response | `tell the interface it failed` (on 12's error route) |
| 14 to 18 | the same as 6 to 10 | same names |
| | **Error routes on 4 and 11** | |
| 20, 21 | Webhooks > Webhook response | `tell the interface it failed` |
| | **Route B: there is nothing to review** | |
| 19 | Webhooks > Webhook response | `tell the interface there is nothing to review` |

The numbers are the module ids in the blueprint. 22 was added last, which is
why it is out of order.

---

### 1. Webhooks > Custom webhook

Name `Scout 7 suggest workflows`. **Get request headers** and **Get request
HTTP method** on.

Data structure `scout_suggest_request`, set on the webhook itself so a request
without these fields is refused before the scenario starts:

| Field | Type | Required |
|---|---|---|
| `company_id` | Text | yes |
| `period_start` | Text, `YYYY-MM-DD` | yes |
| `period_end` | Text, `YYYY-MM-DD` | yes |

The address this gives you is `MAKE_WEBHOOK_SUGGEST`. It is a secret.

### Filter on the link from 1 to 2: `only our own interface`

Exactly as in scenario four:

| Setting | Value |
|---|---|
| Condition | `{{first(map(1.__IMTHEADERS__; "value"; "name"; "x-scout-key"))}}` |
| Operator | Text: Equal to |
| Value | `SCOUT_SHARED_SECRET` |

### 2. HTTP > Make a request

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/rpc/scout_suggest_context` |
| Method | `POST` |
| Headers | `apikey`: the service key. `Authorization`: `Bearer ` then the service key. `Content-Type`: `application/json` |
| Body type | Raw, JSON |
| Request content | `{"p_company_id": "{{1.company_id}}", "p_period_start": "{{1.period_start}}", "p_period_end": "{{1.period_end}}"}` |
| Parse response | **Yes** |
| Stop on an HTTP error | **Yes**, as Gerson's decision 23 requires |

Writing the body by hand is safe: a uuid and two dates hold nothing that needs
escaping. The service key sits in the headers, the same way scenario four holds
it, because the account has no Supabase connection or keychain to reuse.

### 3. Flow control > Router

| Route | Filter name | Condition |
|---|---|---|
| A | `the team history is there` | `{{2.data.ok}}` Boolean: Equal to `true` |
| B | `there is nothing to review` | `{{2.data.ok}}` Boolean: Not equal to `true` |

Route B also catches a database call that failed outright, for example because
migration `0004` has not been applied: PostgREST answers 404 and there is no
`ok` at all.

---

## Route A: the team history is there

### 22. Tools > Set variable

Name `suggest_prompt`, lifetime one cycle. Value: the whole of
`prompts/04_suggest_workflows.md`, pasted in. It is held here once so the
first call and the retry use exactly the same text.

### 4. Anthropic Claude > Create a message

| Field | Value |
|---|---|
| Connection | the existing Anthropic Claude connection, as scenario four |
| Model | `claude-sonnet-4-5`, as scenario four and five |
| Max tokens | 4000 |
| Temperature | 0.2 |
| System prompt | `{{22.suggest_prompt}}` |
| Messages | one message. Role `User`, single string, `{{2.data.prompt_input}}` |

**The module does have a system prompt field.** It is an advanced field, so it
only shows once "Show advanced settings" is on. `docs/decisions.md` decision 15
says there is none; that was true of the fields shown by default.

Error route: module 20, `{ "ok": false, "message": "Claude could not be
reached, so no suggestions were made. Try again in a minute." }`.

### 5. JSON > Parse JSON

JSON string `{{trim(replace(first(map(4.content; "text"; "type"; "text")); "/```(json)?/g"; emptystring))}}`: the text block is picked by its type, not its position, and any markdown fences are stripped first. Gerson's decisions 19 and 22 explain why. Data structure `scout_suggest_reply`:

| Field | Type |
|---|---|
| `candidates` | Array of Collection |
| `title`, `description`, `source_label` | Text |
| `people_affected`, `hours_per_week` | Number |
| `period_start`, `period_end` | Text |
| `score_time`, `score_repetitive`, `score_reliability`, `score_role_distance` | Number |
| `reasoning` | Text |
| `proposed_steps` | Array of Collection: `app`, `action`, `note`, all Text |

**Error route: the one retry from the shared pattern.** Module 11 asks again
with `Return valid JSON only, no commentary` added to the end of the system
prompt. Module 12 reads that reply. If that fails too, module 13 answers the
interface and the run ends. Modules 14 to 18 are 6 to 10 again, mapping from
12 instead of 5.

The shared pattern also writes a failure row to a `make_errors` data store. The
account has no such data store yet, so this scenario does not; the run history
already shows Claude's raw reply on module 11 and 12.

### 6. JSON > Create JSON

Data structure `scout_rpc_save_candidates_request`: `p_company_id`,
`p_period_start`, `p_period_end` (Text) and `p_candidates` (the same array of
collections as module 5).

| Field | Value |
|---|---|
| `p_company_id` | `{{1.company_id}}` |
| `p_period_start` | `{{1.period_start}}` |
| `p_period_end` | `{{1.period_end}}` |
| `p_candidates` | `{{5.candidates}}` |

This is what escapes Claude's text. The reasoning will contain apostrophes and
may contain quotation marks.

### 7. HTTP > Make a request

As module 2, with URL `<SUPABASE_URL>/rest/v1/rpc/scout_save_candidates` and
request content `{{6.json}}`.

### 8. Flow control > Router, then the reply

| Route | Filter name | Condition | Module |
|---|---|---|---|
| 1 | `the suggestions were saved` | `{{7.data.ok}}` Boolean: Equal to `true` | 9 |
| 2 | `saving failed` | `{{7.data.ok}}` Boolean: Not equal to `true` | 10 |

---

## Route B: there is nothing to review

### 19. Webhooks > Webhook response

Status 200, body:

```
{"ok": false, "message": "{{if(2.statusCode = 200; 2.data.message; "The database call failed. Check that migration 0004 has been applied.")}}"}
```

The database's own messages are fixed sentences with no quotation marks, so
writing this body by hand is safe.

---

## What the interface gets back

Status 200 and `Content-Type: application/json` every time, as scenario four.

| Case | Body |
|---|---|
| Saved | `{ "ok": true, "candidates_created": 2 }` |
| No approved days, unknown company, bad period | `{ "ok": false, "message": "There are no approved days in that period to review." }` and the like |
| Database function missing or unreachable | `{ "ok": false, "message": "The database call failed. Check that migration 0004 has been applied." }` |
| Claude unreachable | `{ "ok": false, "message": "Claude could not be reached, so no suggestions were made. Try again in a minute." }` |
| Claude's reply unreadable twice | `{ "ok": false, "message": "Claude did not return valid suggestions twice, so nothing was saved." }` |
| Save failed | `{ "ok": false, "message": "The suggestions could not be saved to the database. Nothing was changed." }` |

A request stopped by the secret filter gets make.com's own `Accepted`, and
nothing is read or written.

## Timing

The two database calls take well under a second between them. Claude writing
up to four suggestions is the rest: expect 15 to 30 seconds. A retry doubles
that and can pass 40 seconds, which the interface will show as a failure; the
suggestions are still saved and appear on the next load.

## How to test

- [ ] Migration `0004_team_history.sql` has been pasted into the Supabase SQL
      editor and run. Running it twice is safe.
- [ ] `select * from team_history where not in_role;` shows "Manual status
      reporting" for Elena, Priya and Jonas.
- [ ] A request with no `x-scout-key` header runs one operation and stops at the
      filter. So does one with the wrong value.
- [ ] A correct request with a company id that does not exist replies
      `{ "ok": false, "message": "There is no company with that id." }` without
      calling Claude. Use this to check the migration is in, for free.
- [ ] One correct request for Brightline Advisory, period `2026-08-31` to
      `2026-09-18`: `candidates_created` is 2 or more, inside 40 seconds.
      Each correct request costs Claude credit.
- [ ] `select rank, title, source_label, hours_per_week, annual_cost_eur,
      total_score from candidates where status = 'proposed' order by rank;`
      puts "Weekly client status report", from "Manual status reporting",
      first, and "Timesheet reconciliation" lower.
- [ ] Running it again replaces the proposed rows, with no duplicates.
- [ ] The blueprint is exported to `make/blueprints/` and holds no key, token or
      webhook address.

Proved live on Sunday 20 September: 2 candidates saved in 10.5 seconds, "Weekly client status report" first from "Manual status reporting", 3 people, 6.4 hours a week, about 19,000 euro a year.

Worth knowing: the period to 18 September has 15 working days, but the
approved history ends on 17 September, so the hours per week come out a little
lower than the prompt's worked example (about 6.4 rather than 6.9 for status
reporting). The ranking is the same.
