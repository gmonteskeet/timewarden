# Scout 2: Split approval

The manager adjusts a role's expected split and approves it. This is the first
human approval the judges see.

**Trigger:** custom webhook, `MAKE_WEBHOOK_SPLIT_APPROVAL`
**Folder:** `Workflow Scout`
**Timing:** well under a second. There is no AI call.

Built on Sunday 20 September. Read `make/specs/README.md` first.

## What it does, in order

1. Refuse anything that is not our own interface.
2. Read the role's topics from the database.
3. Check the numbers: the shares add up to 100, there is one number for every
   topic of the role, and no topic belongs to another role.
4. If they are right: write every share in **one** call, mark the role approved
   with who approved it and when, and reply `{ "ok": true }`.
5. If they are wrong: reply `{ "ok": false, "message": "The shares must add up
   to 100 and every topic must belong to this role." }` and change nothing.

## Why every share is written in one call

A role's shares must always add up to 100: migration `0002` puts a constraint
trigger on `topics` that checks it. The trigger is deferred, so it fires when a
transaction commits, and every HTTP call is its own transaction. Writing the
shares one at a time therefore breaks the rule half way through, when one topic
has its new number and the rest still have their old ones.

So the scenario builds one row per topic with **Create JSON**, joins them into
one list with a **Text aggregator**, and sends them as a single upsert:

- `POST <SUPABASE_URL>/rest/v1/topics?on_conflict=id`
- header `Prefer: resolution=merge-duplicates`
- body `[{{6.text}}]`, the rows in one array

Each row carries `id`, `role_id`, `name` and the new `expected_percent`, because
an upsert writes whole rows. The name comes from the topics just read.

`scripts/reset_demo.mjs` puts the shares back the same way, for the same reason.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 2 split approval` |
| 2 | HTTP > Make a request | `read the role's topics` |
| 3 | Flow control > Router | `do the numbers add up` |
| | **Route A: the split is valid** | |
| 4 | Flow control > Iterator | `each topic` |
| 5 | JSON > Create JSON | `build the topic row` |
| 6 | Tools > Text aggregator | `all the rows in one list` |
| 7 | HTTP > Make a request | `save every share in one call` |
| 8 | HTTP > Make a request | `mark the role approved` |
| 9 | Webhooks > Webhook response | `answer the interface` |
| | **Route B: the split is not valid** | |
| 10 | Webhooks > Webhook response | `tell the interface the numbers are wrong` |

The webhook's data structure is `scout_split_approval_request`: `role_id`,
`approver_id` and `topics`, an array of `{ topic_id, expected_percent }`.
Request headers are on, and the filter `only our own interface` is on the link
from 1 to 2, as in every other scenario.

The three checks in route A's filter are:

| Check | Condition |
|---|---|
| The shares add up to 100 | `{{sum(map(1.topics; "expected_percent"))}}` equals `100` |
| One number per topic | `{{length(1.topics)}}` equals `{{length(2.data)}}` |
| No stranger among them | `{{length(distinct(merge(map(1.topics; "topic_id"); map(2.data; "id"))))}}` equals `{{length(2.data)}}` |

Route B fires when any one of them fails. Whole numbers are checked by the
interface before the call is made.

## How to test

- [ ] No `x-scout-key` header, and a wrong one: both stop at the filter.
- [ ] A split adding up to 101: the plain refusal, and nothing changes in the
      database. **Checked on Sunday 20 September, 0.4 seconds.**
- [ ] Tomas approves the Senior Client Consultant split with two numbers
      changed, 45 to 40 and 20 to 25: both are saved, the other three are
      untouched, and the role is `approved` with Tomas and the time.
      **Checked, 0.4 seconds.**
