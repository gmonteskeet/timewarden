# make.com build sheets

One file per scenario. Each is a click by click sheet: the modules in order,
every field mapping, the exact bodies sent and the shape of what comes back.
Build the scenario in the make.com editor from the sheet, then export the
blueprint to `make/blueprints/` under the same name.

| Sheet | Scenario in make.com | Task | Triggered by |
|---|---|---|---|
| `00_connections.md` | none, this is the setup | G3 | Gerson, by hand |
| `01_calendar_intake.md` | `Scout 1: Calendar intake` | G5 | the agent, and a daily schedule at 07:00 |
| `02_transcript_intake.md` | `Scout 2: Transcript intake` | G6 | the agent |
| `03_voice_and_interview.md` | `Scout 3: Voice intake and interview` | G7 | `MAKE_WEBHOOK_VOICE` |
| `04_answers_and_scoring.md` | `Scout 4: Answers, findings and scoring` | G8 | `MAKE_WEBHOOK_ANSWER` |
| `05_verdicts.md` | `Scout 5: Verdicts` | G9 | `MAKE_WEBHOOK_VERDICT` |
| `06_approval_and_draft.md` | `Scout 6: Approval and draft creation` | G12 | `MAKE_WEBHOOK_DECISION` |

All scenarios live in one make.com folder called `Workflow Scout`. The draft
scenarios that scenario six creates go in a second folder, `Workflow Scout
drafts`.

## The pattern every scenario follows

Read this once. The individual sheets assume it and only write down what is
different.

### 1. Trigger and the shared secret
The trigger is a **Custom webhook**. The first module after it is a **filter**
that lets the run continue only when the request header `x-scout-key` equals the
shared secret. Anything else stops there.

In the filter condition, map the header from the webhook output and compare with
**Text: equal to** against `SCOUT_SHARED_SECRET`. Give the filter a plain name,
for example `only our own interface`, so the run history reads clearly.

The browser never calls these addresses. A Next.js server route calls them and
adds the header. Webhook addresses are secrets in their own right: anyone with
one can write into the database.

### 2. Calling Claude
Use the `Anthropic Claude` app, **Create a message**:

| Field | Value |
|---|---|
| Connection | `Scout Claude` |
| Model | `claude-sonnet-4-5`, or a newer Sonnet if the module offers one |
| Max tokens | 4000 |
| Temperature | 0.2 |
| System prompt | pasted from the named file in `prompts/` |
| User message | a JSON string of the inputs, built with a Set variable module first |

If you pick a newer model than `claude-sonnet-4-5`, write the name in
`docs/decisions.md`. `AGENTS.md` allows it and we should have a record.

Follow every Claude call with a **Parse JSON** module. Give it a data structure
so later modules can map fields by name instead of by guesswork.

**When Claude returns something that is not valid JSON.** Put an error handler
route on the Parse JSON module:

1. First attempt: call Claude again with the same input plus one extra line at
   the end of the system prompt, `Return valid JSON only, no commentary`.
2. Still broken: write the failure to a data store called `make_errors` with the
   scenario name, the time, the input and the raw reply, and let the run end.

One retry, then stop. A scenario that keeps retrying blocks the webhook reply
and the demo stalls.

If Claude starts failing on size rather than format, cut the input down to
activity titles and minutes only. That is the fallback in the build file.

### 3. Reading and writing the database
Use the `Supabase` app modules where they exist: **Select rows**, **Insert a
row**, **Update a row**. They are clearer in the run history, which matters when
something breaks in front of judges.

For bulk inserts, use the `HTTP` app against the Supabase REST address instead,
posting an array in one call. One HTTP call beats twenty iterations.

- Method `POST`, address `<SUPABASE_URL>/rest/v1/<table>`
- Headers: `apikey` and `Authorization: Bearer` both set to the service key,
  `Content-Type: application/json`, and `Prefer: return=representation` when you
  need the inserted ids back
- Body: the array of rows

The service key ignores row level security, which is why make.com can write at
all. It never leaves make.com.

### 4. Replying
The last module is **Webhook response**, status 200, `Content-Type:
application/json`, and a body matching `AGENTS.md` section 6:

| Scenario | Reply |
|---|---|
| `Scout 3: Voice intake and interview` | `{ "ok": true, "voice_note_id": "...", "questions_created": 3 }` |
| `Scout 4: Answers, findings and scoring` | `{ "ok": true, "remaining": 2 }` |
| `Scout 5: Verdicts` | `{ "ok": true }` |
| `Scout 6: Approval and draft creation` | `{ "ok": true, "make_scenario_url": "https://..." }` |

Every reply must arrive within 40 seconds. If a scenario cannot finish in time,
reply early with what is already known and let the rest of the run carry on.
Marcus's screen polls the database for the rest. A late reply looks like a
crash.

### 5. Naming and exporting
Name scenarios `Scout 1: Calendar intake`, `Scout 2: Transcript intake`, and so
on, exactly as in the table above. The run history is on screen during the demo
and the names are read out loud.

After building each one, export the blueprint and save it to
`make/blueprints/<the same name>.json`. Then open the file and search it for
keys, tokens and webhook addresses before committing. Task G17 sweeps everything
again on Sunday morning, but catching it here is cheaper.

### 6. Before you call a scenario done
- The filter refuses a request with no `x-scout-key` header, and one with a
  wrong value.
- A correct request returns the reply shape above, within 40 seconds.
- The rows you expect are in the database, with no duplicates on a second run.
- The blueprint is exported and contains no secrets.
