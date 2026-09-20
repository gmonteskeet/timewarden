# Scout 4: Interview turn

One turn of the check in interview. The interface sends what the employee just
said, this scenario asks Claude what to say next, saves it and replies. It is
the module the judges watch working.

**Trigger:** custom webhook, `MAKE_WEBHOOK_INTERVIEW`
**Folder:** `Workflow Scout`
**Time limit: 12 seconds for the whole run.** The interface gives up after that
and the employee sees a failure.

Read `make/specs/README.md` first. It holds the shared pattern: the secret
filter, how Claude is called, how the database is reached, and how a broken
JSON reply is retried. This sheet only writes down what is different.

## What it does, in order

1. Refuse anything that is not our own interface.
2. In **one** call to the database: record the employee's answer, and read back
   the check in, the person, their role, the approved topics, the day's
   calendar and calls, and the interview so far.
3. If Scout has already asked six questions, skip Claude and close the
   interview with a fixed line.
4. Otherwise ask Claude for the next question, save it, and reply.
5. When the interview is done, start `Scout 5: Day summary` without waiting.

## The one database call

Migration `0003_interview_context.sql` adds `public.scout_interview_context`.
It exists because six separate Supabase modules would be six round trips before
Claude is even asked, and the whole run has twelve seconds.

It takes `p_check_in_id` and an optional `p_employee_text`. When
`p_employee_text` has something in it, the function saves it as the next
interview turn, speaker `employee`, and moves the check in from `invited` to
`in_progress`. Then it reads everything back, including the answer it has just
saved, so Claude sees the reply it is answering.

It gives back:

| Field | What it is |
|---|---|
| `ok` | `false` with an `error` when there is no check in with that id |
| `check_in_id`, `person_id`, `day`, `status` | the check in |
| `first_name` | for the closing line |
| `working_minutes` | normally 480 |
| `scout_turns_asked` | how many questions Scout has asked so far |
| `next_turn_no` | the turn number the question you are about to save gets |
| `prompt_input` | **the whole user message for Claude, already written as JSON text** |

`prompt_input` holds exactly the eight fields `prompts/README.md` lists for
`02_interview_turn.md`, with the times in Madrid time. Map that one field into
the Claude module instead of building eight by hand.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 4 interview turn` |
| 2 | JSON > Create JSON | `build the database call` |
| 3 | HTTP > Make a request | `read the check in and record the answer` |
| 4 | Flow control > Router | `has Scout asked six questions` |
| | **Route A: Scout still has questions** | |
| 5 | Anthropic Claude > Create a message | `write the next question` |
| 6 | JSON > Parse JSON | `read Claude's reply` |
| 7 | Supabase > Insert a row | `save Scout's question` |
| 8 | JSON > Create JSON | `build the reply` |
| 9 | Webhooks > Webhook response | `answer the interface` |
| 10 | Make > Run a scenario | `start the day summary` |
| | **Route B: the six question cap is reached** | |
| 11 | Tools > Set variable | `the closing line` |
| 12 | Supabase > Insert a row | `save the closing line` |
| 13 | JSON > Create JSON | `build the reply` |
| 14 | Webhooks > Webhook response | `answer the interface` |
| 15 | Make > Run a scenario | `start the day summary` |

**Build route A first and get the demo working end to end. Route B is the
safety net.** Add it once route A answers Elena properly. If you run out of
time, route A alone still tells the whole story, because the prompt stops
itself at six questions as well.

---

### 1. Webhooks > Custom webhook

Name `Scout 4 interview turn`. In the webhook's own settings switch on **Get
request headers**, or module 1 has no `headers` to filter on.

Data structure `scout_interview_request`:

| Field | Type | Required |
|---|---|---|
| `check_in_id` | Text | yes |
| `employee_text` | Text | no |

The interface sends `employee_text: null` on the very first call, when the
employee has opened the page and Scout has not said anything yet.

The address this gives you is `MAKE_WEBHOOK_INTERVIEW`. It is a secret. Send it
to Marcus by direct message, never in the repository.

### Filter on the link from 1 to 2: `only our own interface`

| Setting | Value |
|---|---|
| Condition | ``{{1.headers.`x-scout-key`}}`` |
| Operator | Text: Equal to |
| Value | the `SCOUT_SHARED_SECRET` you generated in `00_connections.md` |

The backticks around `x-scout-key` are needed because of the hyphen. If your
version of make.com hands `headers` back as a list of name and value pairs
rather than a collection, use this instead:

```
{{first(map(1.headers; "value"; "name"; "x-scout-key"))}}
```

Check both cases before moving on: a request with no header and a request with
the wrong value must both stop here.

### 2. JSON > Create JSON

This module exists to escape the employee's own words. They may contain
quotation marks or line breaks, and either one breaks a hand written JSON body.

Data structure `scout_rpc_interview_request`:

| Field | Type |
|---|---|
| `p_check_in_id` | Text |
| `p_employee_text` | Text |

Mapping:

| Field | Value |
|---|---|
| `p_check_in_id` | `{{1.check_in_id}}` |
| `p_employee_text` | `{{1.employee_text}}` |

On the first call `employee_text` is empty, the field is left out, and the
database function's own default takes over. That is the behaviour we want.

### 3. HTTP > Make a request

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/rpc/scout_interview_context` |
| Method | `POST` |
| Headers | `apikey`: the service key. `Authorization`: `Bearer ` then the service key. `Content-Type`: `application/json` |
| Body type | Raw |
| Content type | JSON (application/json) |
| Request content | `{{2.json}}` |
| Parse response | **Yes** |

Run this module once on its own with Elena's check in id before you build
anything after it. Everything downstream maps from its output, and make.com
only offers those fields once it has seen a reply.

The fields then appear as `{{3.data.scout_turns_asked}}`,
`{{3.data.prompt_input}}` and so on.

### 4. Flow control > Router

Two routes, with a filter on each.

| Route | Filter name | Condition |
|---|---|---|
| A | `Scout still has questions` | `{{3.data.scout_turns_asked}}` Numeric: Less than `6` |
| B | `the six question cap is reached` | `{{3.data.scout_turns_asked}}` Numeric: Greater than or equal to `6` |

Six is the same number as rule 7 of `prompts/02_interview_turn.md`. The prompt
normally stops itself; this is what happens when it does not.

---

## Route A: Scout still has questions

### 5. Anthropic Claude > Create a message

| Field | Value |
|---|---|
| Connection | `Scout Claude` |
| Model | as at the top of `make/specs/README.md` |
| Max tokens | **600** |
| Temperature | 0.2 |
| Messages | one message. Role `User`. See below. |

**The module has no system prompt field.** Checked against a real blueprint:
`anthropic-claude:createAMessage` version 1 takes `model`, `messages`,
`max_tokens` and `temperature`, and nothing else. So the whole of
`prompts/02_interview_turn.md` goes at the top of the user message, then a
blank line, then `Here is the input for this turn:`, then
`{{3.data.prompt_input}}`. Claude reads it the same way.

600 is deliberate. One question is two or three lines and a bigger budget only
buys a slower reply.

### 6. JSON > Parse JSON

JSON string, the same tolerant reading as scenario seven:

```
{{trim(replace(first(map(5.content; "text"; "type"; "text")); "/```(json)?/g"; emptystring))}}
```

Two things are going on, and both matter. `first(map(...; "type"; "text"))`
picks the reply out of the `content` list **by block type** rather than by
position, so a model that puts a `thinking` block first cannot empty it
(decision 19). The `replace` then strips any markdown code fence before Parse
JSON ever sees the text (decision 21). The retry route, module 16, carries the
same expression against module 15.

This is what Galtea's evaluation of the interview turn was checking. It found
that 7 of 22 replies, about one in three, came back wrapped in a code fence.
Every one of those 7 parses through the expression above, so the live scenario
was already tolerant of the fault the evaluation found. The four new prompt
rules written in answer to it, including "never a code fence", are in
`prompts/02_interview_turn.md` and have **not** been pasted into the Set
variable in make.com. `docs/galtea_findings.md` has the numbers.

Data structure `scout_interview_reply`:

| Field | Type |
|---|---|
| `done` | Boolean |
| `question` | Text |
| `kind` | Text |
| `evidence` | Text |

Put the retry route from the shared pattern on this module's error handler: one
more Claude call with `Return valid JSON only, no commentary` added to the end
of the system prompt, and if that fails too, a row in the `make_errors` data
store and the run ends. One retry, never a loop. There are twelve seconds.

### 7. Supabase > Insert a row

Table `interview_turns`.

| Column | Value |
|---|---|
| `check_in_id` | `{{1.check_in_id}}` |
| `turn_no` | `{{3.data.next_turn_no}}` |
| `speaker` | `scout` |
| `text` | `{{6.question}}` |
| `kind` | `{{6.kind}}` |
| `evidence` | `{{6.evidence}}` |

`next_turn_no` was worked out after the employee's answer was saved, so it is
already the right number for Scout's question.

### 8. JSON > Create JSON

Data structure `scout_interview_response`:

| Field | Type | Value |
|---|---|---|
| `ok` | Boolean | `true` |
| `done` | Boolean | `{{6.done}}` |
| `turn_no` | Number | `{{3.data.next_turn_no}}` |
| `question` | Text | `{{6.question}}` |
| `kind` | Text | `{{6.kind}}` |
| `evidence` | Text | `{{6.evidence}}` |

Claude's question will contain apostrophes and may contain quotation marks.
Building this by hand in the response body breaks the first time it does.

### 9. Webhooks > Webhook response

| Setting | Value |
|---|---|
| Status | `200` |
| Body | `{{8.json}}` |
| Custom headers | `Content-Type`: `application/json` |

This sits **before** the module that starts the summary, so the employee sees
the next question as soon as it exists. Nothing after this module can make the
reply any later.

### 10. Make > Run a scenario

With a filter on the link from 9 to 10, named `the interview is finished`:
`{{6.done}}` Boolean: Equal to `true`.

| Setting | Value |
|---|---|
| Scenario | `Scout 5: Day summary` |
| Wait until the scenario is finished | **No** |
| Body | `{"check_in_id": "{{1.check_in_id}}"}` |

Waiting here would add the whole summary to the twelve seconds and the
interview would time out. The interface polls the check in's status instead and
shows the summary when it turns `summarised`.

If your account has the newer `Scenarios > Call a scenario` module, it does the
same job asynchronously and does not spend operations. Either is fine.

---

## Route B: the six question cap is reached

### 11. Tools > Set variable

Name `closing_line`. Value:

```
Thank you {{3.data.first_name}}, that gives me a clear picture of your day and your summary is ready.
```

Same sentence as rule 8 of the prompt, so the employee cannot tell which route
they got.

### 12. Supabase > Insert a row

Table `interview_turns`.

| Column | Value |
|---|---|
| `check_in_id` | `{{1.check_in_id}}` |
| `turn_no` | `{{3.data.next_turn_no}}` |
| `speaker` | `scout` |
| `text` | `{{11.value}}` |
| `kind` | `closing` |
| `evidence` | leave empty |

### 13. JSON > Create JSON

Same data structure as module 8.

| Field | Value |
|---|---|
| `ok` | `true` |
| `done` | `true` |
| `turn_no` | `{{3.data.next_turn_no}}` |
| `question` | `{{11.value}}` |
| `kind` | `closing` |
| `evidence` | leave empty |

### 14. Webhooks > Webhook response

Status `200`, body `{{13.json}}`, header `Content-Type: application/json`.

### 15. Make > Run a scenario

`Scout 5: Day summary`, wait **No**, body `{"check_in_id": "{{1.check_in_id}}"}`.
No filter: reaching the cap always ends the interview.

---

## What the interface gets back

`frontend/lib/contract.ts` calls this `InterviewReply`, and
`AGENTS.md` section 6 says the same:

```json
{
  "ok": true,
  "done": false,
  "turn_no": 3,
  "question": "On Friday from 14:00 to 16:30, two and a half hours, you had Friday report send out; what does that involve?",
  "kind": "elaboration",
  "evidence": "Calendar: Friday report send out, 14:00 to 16:30, no other attendees."
}
```

`kind` is one of `opening`, `calendar_gap`, `unexplained_meeting`,
`elaboration`, `confirmation`, `closing`. Marcus's interface shows `evidence`
under the question, so the employee can see what Scout is going on.

## Before you call it done

- [ ] A request with no `x-scout-key` header stops at the filter. So does one
      with the wrong value.
- [ ] First call, `employee_text` null: Scout greets Elena by name and asks
      about the empty stretch from 09:00 to 11:00, mentioning Sophie
      Lindqvist's 40 minute call. `turn_no` is 1.
- [ ] Second call with Elena's answer from `data/interview_script.md`: her
      answer is saved as turn 2 and Scout asks about something else. The check
      in is now `in_progress`.
- [ ] Scout never asks about 12:00 to 13:00. That is lunch.
- [ ] Working through `data/interview_script.md`, the interview asks about the
      09:00 to 11:00 gap and about "Friday report send out", and finishes in
      six questions or fewer with `done: true` and `kind: "closing"`.
- [ ] On that last turn, `Scout 5: Day summary` starts and this scenario does
      not wait for it.
- [ ] **Every run finishes inside 12 seconds.** Check the real number in the
      run history, not how it feels.
- [ ] Route B: set the cap to 1 for one test run, confirm the closing line
      comes back without Claude being called, then put it back to 6.
- [ ] The blueprint is exported to `make/blueprints/` and holds no key, token
      or webhook address.

## If it is too slow

In this order:

1. Lower max tokens on module 5 below 600.
2. Cut the context. `scout_day_context` in migration `0003` builds
   `prompt_input`; drop `attendees` and `description` from the calendar entries
   there and every run gets smaller. Change it in the migration, not in
   make.com, so the summary gets the same treatment.
3. Drop the oldest turns from `turns_so_far`, keeping the last four.

Do not take the retry route off. A broken reply with no retry is a dead
interview in front of the judges.

## Sunday 20 September: hardened for the demo

Three changes, all proved with a live run of Elena's Friday (first question
5.2 seconds, later turns 2.6 to 3.8 seconds, well inside the twelve):

1. **The prompt is held once** in a `Tools > Set variable` module named `the
   interview prompt`, so the first call and the retry use the same text.
2. **Scout's question is saved through a `JSON > Create JSON` module**
   (data structure `scout_interview_turn_row`) instead of a hand written body,
   so a question containing a quotation mark, an apostrophe or a new line saves
   correctly. Every database module now stops the run on an HTTP error, so a
   refused insert can never look like a success. This is Gerson's decision 23,
   applied to this scenario as well.
3. **The one retry is in place.** The error route on `read the model's reply`
   asks Claude again with `Return valid JSON only, no commentary`, reads that
   reply, and hands it back to the main flow with a `Resume` directive, so the
   rest of the scenario is unchanged. If the second reply is broken too, the
   interface is told `{ "ok": false, "message": "Scout could not read that
   reply. Your answer is saved. Please try again." }`. There is no `make_errors`
   data store in the account, so nothing is written there.

The model is `claude-sonnet-4-5` and the reply is read with
`{{trim(replace(first(map(5.content; "text"; "type"; "text")); "/```(json)?/g"; emptystring))}}`,
which picks the text block by its type and strips markdown fences.

## Checked again on Sunday 20 September, after the Galtea evaluation

The evaluation reported that Claude wraps its JSON reply in a markdown code
fence in about one reply in three, so the reply reading was checked against the
live scenario rather than against the repository copy. Module 6 and its retry,
module 16, already carried the expression above, character for character the
same as scenario seven's modules 5 and 12. Nothing in the scenario needed
changing, so nothing was changed, and the backup taken before the check is at
`../make_backups/Scout 4 Interview turn 0831.json`.

Proved end to end afterwards: `scripts/reset_demo.mjs`, then one full interview
as Elena through the live routes on `https://workflow-scout.vercel.app` with
her scripted answers from `data/interview_script.md`. Three turns, every one a
success, the slowest 6.9 seconds against the 12 second limit, and the summary
arrived with 480 minutes split 230 outside the role and 250 in it, exactly the
table in the interview script.

Still open: the expression strips a fence, but it does not strip a sentence
written either side of the JSON. Scenario seven does not either. If that is
wanted, it is one more `replace` around the same expression,
`"/^[^{]*|[^}]*$/g"` to `emptystring`, applied to all three scenarios together
so they stay the same as each other.
