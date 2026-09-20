# Scout 8: Decision and draft creation

The manager approves a suggestion and a real draft scenario appears in
make.com. This is the ending of the demo.

**Trigger:** custom webhook, `MAKE_WEBHOOK_DECISION`
**Folder:** `Workflow Scout`
**Time limit:** 40 seconds. One Claude call, four short database calls.

Built on Sunday 20 September, when Gerson was unavailable. Read
`make/specs/README.md` first for the shared pattern.

## What it does, in order

1. Refuse anything that is not our own interface.
2. Read the suggestion by its id.
3. Then one of four things:
   - **It is not there:** reply `{ "ok": false, "message": "There is no
     suggestion with that id." }`.
   - **It already has a draft:** hand the same link back and change nothing, so
     a double click can never make two drafts.
   - **Not now:** record the approval row with the decision `rejected`, mark the
     suggestion rejected, reply `{ "ok": true }`.
   - **Approved:** record the approval row, mark the suggestion approved, read
     the people who do this work, and ask Claude to fill the draft template.

## No database functions

Migration `0005` could not be applied on Sunday: nobody had the Supabase SQL
editor. Every step is therefore a plain REST call, as section 3 of the shared
pattern describes, with the address and the service key held the same way
scenarios four, five and seven hold them. Every database module stops the run
on an HTTP error, so a refused write can never look like a success.

## The step that is missing, and why

The last step, the one that creates the draft scenario, is **not in the
scenario yet**. It is a single HTTP call:

| Setting | Value |
|---|---|
| URL | `https://eu1.make.com/api/v2/scenarios?confirmed=true` |
| Method | `POST` |
| Headers | `Authorization`: `Token ` then the make.com API token. `Content-Type`: `application/json` |
| Body | the request built by `build the make.com request`: `teamId`, `folderId` of `Workflow Scout drafts`, `blueprint` as a JSON string, `scheduling` as a JSON string |
| Parse response | Yes, and stop on an HTTP error |

It needs a make.com API token, and on Sunday morning there was no way to get
one: the account holds no keychain entry, and reading the token from the local
settings was refused. See `docs/decisions.md` decision 25.

**Until the token is in place** the scenario replies
`{ "ok": true, "draft_values": { ... } }` and leaves the suggestion `approved`.
The manager's screen shows the suggestion approved with no link. Nothing is
lost: the approval is recorded, and the same call can be made again once the
step is added.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 8 decision and draft` |
| 2 | HTTP > Make a request | `read the suggestion` |
| 3 | Flow control > Router | `what kind of decision is this` |
| | **Route A: the suggestion is not there** | |
| 4 | Webhooks > Webhook response | `tell the interface it is not there` |
| | **Route B: there is already a draft** | |
| 5 | Webhooks > Webhook response | `hand back the draft that exists` |
| | **Route C: not now** | |
| 6 | JSON > Create JSON | `build the approval row` |
| 7 | HTTP > Make a request | `record the decision` |
| 8 | HTTP > Make a request | `mark the suggestion rejected` |
| 9 | Webhooks > Webhook response | `answer the interface` |
| | **Route D: approved** | |
| 10 | JSON > Create JSON | `build the approval row` |
| 11 | HTTP > Make a request | `record the decision` |
| 12 | HTTP > Make a request | `mark the suggestion approved` |
| 13 | HTTP > Make a request | `read the people who do this work` |
| 14 | Tools > Set variable | `the draft filling prompt` |
| 15 | JSON > Create JSON | `build the input for Claude` |
| 16 | Anthropic Claude > Create a message | `fill the template` |
| 17 | JSON > Parse JSON | `read Claude's reply` |
| 18, 19, 20 | the one retry, then `Resume` | `ask again, JSON only` |
| 21 | JSON > Create JSON | `the values for the draft` |
| 32 | Webhooks > Webhook response | `answer the interface` |
| 30, 31 | Webhooks > Webhook response | `tell the interface it failed` |

The four routes are mutually exclusive, because each filter also checks whether
a draft link exists. A router fires every route whose filter passes, so the
checks have to be written that way.

### 1. Webhooks > Custom webhook

Name `Scout 8 decision and draft`, request headers on, data structure
`scout_decision_request`:

| Field | Type | Required |
|---|---|---|
| `candidate_id` | Text | yes |
| `approver_id` | Text | yes |
| `decision` | Text, `approved` or `rejected` | yes |
| `comment` | Text | no |

The address is `MAKE_WEBHOOK_DECISION`. It is a secret.

### The filter on the link from 1 to 2

`only our own interface`, exactly as in scenarios four and seven.

### 2. HTTP > Make a request

`GET <SUPABASE_URL>/rest/v1/candidates?id=eq.{{1.candidate_id}}&select=*`,
parse the response, stop on an HTTP error. Everything after this reads the
suggestion with `{{get(first(2.data); "...")}}`.

### 16. Anthropic Claude > Create a message

| Field | Value |
|---|---|
| Connection | the existing Anthropic Claude connection |
| Model | `claude-sonnet-4-5` |
| Max tokens | 1500 |
| Temperature | 0.2 |
| System prompt | `{{14.draft_prompt}}`, the whole of `prompts/05_draft_workflow_fill.md` |
| Messages | one user message, `{{15.json}}` |

The input is built with Create JSON against the data structure
`scout_draft_prompt_input`, so the suggestion's own text, which contains
quotation marks and apostrophes, is escaped properly.

### 17. JSON > Parse JSON

Data structure `scout_draft_fill_reply`: `scenario_name`, `schedule`
(`day`, `time`), `source_sheet_name`, `recipients` and `summary_prompt`. The
reply is read with the same expression as the other scenarios, which picks the
text block by its type and strips markdown fences. The error route asks once
more with `Return valid JSON only, no commentary` and hands the second reply
back to the main flow with a `Resume` directive.

## The template the draft is made from

`TEMPLATE: Weekly client status report`, in the folder `Workflow Scout`,
switched off. Its shape with placeholders is
`make/blueprints/template_weekly_status_report.tpl.json`:
`{{scenario_name}}`, `{{source_sheet_name}}`, `{{recipients}}`,
`{{summary_prompt}}`, `{{schedule_day}}`, `{{schedule_time}}` and
`{{proposed_steps_note}}`.

A suggestion that is not a weekly report still gets this template, renamed,
with its proposed steps in the scenario note. That is the agreed, honest
fallback: a draft for a person to finish, not a finished workflow.

## What the interface gets back

| Case | Body |
|---|---|
| Rejected | `{ "ok": true }` |
| A draft already exists | `{ "ok": true, "make_scenario_url": "https://..." }` |
| Approved, draft creation still to come | `{ "ok": true, "draft_values": { ... } }` |
| Approved, once the last step is added | `{ "ok": true, "make_scenario_url": "https://..." }` |
| No such suggestion | `{ "ok": false, "message": "There is no suggestion with that id." }` |
| Claude unreachable or unreadable twice | `{ "ok": false, "message": "..." }`, and the suggestion stays approved |

The interface polls the suggestion for up to 60 seconds after the call, so a
link that appears a little later still reaches the screen.

## How to test

- [ ] No `x-scout-key` header, and a wrong one: both stop at the filter and
      use one operation. **Checked on Sunday 20 September.**
- [ ] A made up suggestion id: `{ "ok": false, "message": "There is no
      suggestion with that id." }` and no Claude call. **Checked.**
- [ ] One real approval with Tomas Berg as the approver: the approvals table
      gains a row, the suggestion turns `approved`, and the reply carries the
      filled values.
- [ ] The same call again: the suggestion is already approved, so it is
      recorded once more only if no draft exists. Once the draft step is in
      place, the second call hands back the same link and makes no second
      draft.
