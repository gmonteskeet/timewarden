# make.com build sheets

One file per scenario. Each is a click by click sheet: the modules in order,
every field mapping, the exact bodies sent and the shape of what comes back.
Build the scenario in the make.com editor from the sheet, then export the
blueprint to `make/blueprints/` under the same name.

## The model we use
`AGENTS.md` section 3 says the model is recorded here.

**Model: `claude-sonnet-4-5`.** Set it in every Anthropic Claude module.
`claude-sonnet-5` was tried and taken back out: it thinks before it answers,
which put one interview turn at 118 seconds against a 12 second limit. Measured
both ways in decision 21.

Three things to get right, all found the hard way:

- `messages[].content[]` must carry `"type": "text"`. make.com's own public
  template leaves it out and Anthropic refuses the call. Decision 18.
- `max_tokens` and `temperature` must be numbers, not strings. Same template,
  same problem. Decision 18.
- Read the reply out of the `content` list **by block type**, not by position:
  `{{first(map(5.content; "text"; "type"; "text"))}}`. A model that thinks puts
  a `thinking` block first and `content[1].text` is then empty. Decision 19.

Strip markdown fences before Parse JSON. Every prompt says JSON only and Claude
almost always obeys, but "almost" is not a thing to demo on. Decision 21.

## The scenarios

| Sheet | Scenario | Trigger |
|---|---|---|
| `01_role_documents_and_splits.md` | `Scout 1: Role documents and expected splits` | `MAKE_WEBHOOK_ROLES_SYNC`, and weekly |
| `02_split_approval.md` | `Scout 2: Split approval` | `MAKE_WEBHOOK_SPLIT_APPROVAL` |
| `03_morning_run.md` | `Scout 3: Morning run` | weekdays 07:30, and `MAKE_WEBHOOK_MORNING_RUN` |
| `03a_calendar_intake.md` | `Scout 3a: Calendar intake` | called by scenario three |
| `03b_transcript_intake.md` | `Scout 3b: Transcript intake` | called by scenario three |
| `04_interview_turn.md` | `Scout 4: Interview turn` | `MAKE_WEBHOOK_INTERVIEW` |
| `05_day_summary.md` | `Scout 5: Day summary` | called by scenario four |
| `06_submit_and_day_approval.md` | `Scout 6: Submit and day approval` | `MAKE_WEBHOOK_SUBMIT`, `MAKE_WEBHOOK_DAY_APPROVAL` |
| `07_suggest_workflows.md` | `Scout 7: Suggest workflows` | `MAKE_WEBHOOK_SUGGEST` |
| `08_decision_and_draft.md` | `Scout 8: Decision and draft creation` | `MAKE_WEBHOOK_DECISION` |

`00_connections.md` is the setup Gerson does by hand before any of this.

All eight live in one make.com folder called `Workflow Scout`. The draft
scenarios that scenario eight creates go in a second folder, `Workflow Scout
drafts`.

Scenarios four and five are the heart of the demo. Build them first.

## The pattern every scenario follows

Read this once. The individual sheets assume it and only write down what is
different.

### 1. Trigger and the shared secret
The trigger is a **Custom webhook**, except for the two sub scenarios (3a and
3b) and scenario five, which are started by another scenario.

The first module after a webhook is a **filter** that lets the run continue only
when the request header `x-scout-key` equals the shared secret. Anything else
stops there. Map the header from the webhook output, compare with **Text: equal
to** against `SCOUT_SHARED_SECRET`, and give the filter a plain name such as
`only our own interface`, so the run history reads clearly.

The browser never calls these addresses. A Next.js server route calls them and
adds the header. Webhook addresses are secrets in their own right: anyone
holding one can write into the database.

### 2. Calling Claude
Use the `Anthropic Claude` app, **Create a message**:

| Field | Value |
|---|---|
| Connection | `Scout Claude` |
| Model | as at the top of this file |
| Max tokens | 4000, except the interview turn, which is 1500 |
| Temperature | 0.2 |
| Messages | one message, role `User`. See below. |

**There is no system prompt field.** The module takes `model`, `messages`,
`max_tokens` and `temperature` and nothing else. So the whole prompt file goes
at the top of the user message, then a blank line, then the inputs as JSON.

`prompts/README.md` lists, for each prompt, exactly which inputs go in and what
comes back. Do not invent field names.

Follow every Claude call with a **Parse JSON** module, with a data structure
set, so later modules map fields by name instead of by guesswork.

### Reading the reply: the one that will catch you out

**Never map `content[1].text`.** Claude returns `content` as a list of blocks,
and a model that reasons puts a `thinking` block in front of the `text` one.
`content[1]` is then the thinking block, its `text` is empty, and Parse JSON
fails with `Validation failed for 1 parameter(s)`. It works on a short first
call and breaks once there is anything to reason about, which makes it look
intermittent. Read the block by **type**:

```
{{trim(replace(first(map(4.content; "text"; "type"; "text")); "/```(json)?/g"; emptystring))}}
```

That picks the text block wherever it sits and strips a markdown fence if the
model adds one. Replace `4` with the number of your Claude module.

**Check any scenario already built against this.** `Scout 7: Suggest workflows`
was written with `content[1].text` and `claude-sonnet-5` and will fail on a real
run for exactly this reason.

**When Claude returns something that is not valid JSON.** Put an error handler
route on the Parse JSON module:

1. Call Claude again with the same input plus one extra line at the end of the
   system prompt: `Return valid JSON only, no commentary`.
2. Still broken: write the failure to a data store called `make_errors` with the
   scenario name, the time, the input and the raw reply, then let the run end.

One retry, then stop. A scenario that keeps retrying blocks the reply and the
demo stalls.

If Claude starts failing on size rather than format, cut the input down: for the
interview, activity titles, times and minutes only.

### 3. Reading and writing the database
The `HTTP` app needs no connection at all, so scenarios four and five use it for
every read and write. That is the only reason they could be built before anyone
had set a Supabase connection up. The Supabase app modules read a little more
clearly in the run history, and either is fine.

**Three things that will waste your evening if you write a body by hand:**

- Switch **stop on HTTP error** on. Without it a 4xx is ignored, the run goes
  green and nothing is written.
- A uuid column written as `{{ifempty(<expression>; null)}}` in a raw body comes
  out as `""`, and Postgres answers `400 invalid input syntax for type uuid`.
  Build the row with a **Create JSON** module instead, where the IML keyword
  `null` really does become a JSON null. `emptystring` does not.
- `map(list; "id"; "name"; <empty>)` has nothing to filter on and returns
  **every** row, so `first()` gives you a plausible wrong answer rather than
  nothing. Guard it.

For bulk inserts use the `HTTP` app against the Supabase REST address instead,
posting an array in one call. One HTTP call beats twenty iterations.

- Method `POST`, address `<SUPABASE_URL>/rest/v1/<table>`
- Headers: `apikey` and `Authorization: Bearer`, both the service key,
  `Content-Type: application/json`, and `Prefer: return=representation` when the
  inserted ids are needed back
- Body: the array of rows

In version 2 the service key is the **only** way in. Row level security is on
for every table with no policies at all, so an anonymous request sees nothing.
The key never leaves make.com and the Next.js server.

### 4. Calling one scenario from another
Use the `make` app, **Run a scenario**. Two rules:

- Scenario three waits for 3a and 3b, because it needs the day's activities in
  place before it invites anyone.
- Scenario four starts scenario five **without waiting**. The interview must
  reply inside 12 seconds and the summary takes longer than that.

### 5. Replying
The last module of a webhook scenario is **Webhook response**, status 200,
`Content-Type: application/json`, body as in `AGENTS.md` section 6:

| Scenario | Reply |
|---|---|
| `Scout 1: Role documents and expected splits` | `{ "ok": true, "roles_read": 4, "topics_proposed": 22 }` |
| `Scout 2: Split approval` | `{ "ok": true }` |
| `Scout 3: Morning run` | `{ "ok": true, "check_ins_created": 3, "emails_sent": 3 }` |
| `Scout 4: Interview turn` | `{ "ok": true, "done": false, "turn_no": 3, "question": "...", "kind": "calendar_gap", "evidence": "..." }` |
| `Scout 6`, submit and day approval | `{ "ok": true }` |
| `Scout 7: Suggest workflows` | `{ "ok": true, "candidates_created": 4 }` |
| `Scout 8: Decision and draft creation` | `{ "ok": true, "make_scenario_url": "https://..." }`, or `{ "ok": true, "draft_values": { ... } }` until the draft creating step has its token. See `08_decision_and_draft.md`. |

**Timing.** The interview turn must reply within **12 seconds**. Everything else
has 40 seconds. If a scenario cannot finish in time, reply early with what is
known and let the rest of the run carry on. The interface polls the database for
the rest. A late reply looks like a crash.

### 6. Naming and exporting
Name scenarios exactly as in the table above. The run history is on screen
during the demo and the names are read out loud.

After building each one, export the blueprint to `make/blueprints/<the same
name>.json`. Open the file and search it for keys, tokens, webhook addresses and
folder ids before committing. Task G17 sweeps everything again on Sunday
morning, but catching it here is cheaper.

### 7. Before you call a scenario done
- The filter refuses a request with no `x-scout-key` header, and one with a
  wrong value.
- A correct request returns the reply shape above, inside its time limit.
- The rows you expect are in the database, with no duplicates on a second run.
- The blueprint is exported and holds no secrets.
