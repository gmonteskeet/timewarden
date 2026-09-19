# Scout 5: Day summary

Turns one finished interview into the picture the employee sees: how the day's
working minutes divided across the topics of their role, and how much went to
work outside it. This is the screen the whole demo builds to.

**Trigger:** started by `Scout 4: Interview turn`, never by the interface
**Folder:** `Workflow Scout`
**Time limit:** none that matters. Scenario four has already replied and the
interface is polling the check in's status. Take the time to get it right.

Read `make/specs/README.md` first for the shared pattern.

## What it does, in order

1. Read the day, the interview and the labels this company already uses for
   work outside a role, in one call.
2. Ask Claude to divide the working minutes.
3. **In make.com, not in the model:** check the minutes add up to the working
   day, give any small remainder to the largest row, work out each percentage,
   and turn each topic name back into a topic id.
4. Replace the check in's allocations and the day's interview activities.
5. Write the summary and set the check in to `summarised`, which is what tells
   the interface the screen is ready.

The model divides the day. make.com does every sum. That split is deliberate:
a model that is asked to do arithmetic will sooner or later hand you 470
minutes and a straight face.

## No shared secret filter

Scenario five is started by scenario four, not by the interface, so there is no
`x-scout-key` header to check, exactly as `make/specs/README.md` section 1 says.
Its webhook address stays inside make.com and goes to nobody, not even Marcus.

## The one database call

`public.scout_summary_context`, from migration `0003_interview_context.sql`.
Takes `p_check_in_id`. Read only. It gives back:

| Field | What it is |
|---|---|
| `ok` | `false` with an `error` when there is no check in with that id |
| `check_in_id`, `person_id`, `day`, `status` | the check in |
| `working_minutes` | what the allocations must add up to |
| `topic_map` | `[{ "name": ..., "topic_id": ... }]`, for turning a name from Claude back into an id |
| `prompt_input` | **the whole user message for Claude, already written as JSON text** |

`prompt_input` holds exactly the nine fields `prompts/README.md` lists for
`03_day_summary.md`: the same context as the interview, with the full
`interview` in place of `turns_so_far`, plus `known_outside_labels`.

`known_outside_labels` is what keeps the history usable. Without it the same
work is called "Manual status reporting" on Monday and "Status pack admin" on
Tuesday, and scenario seven sees two small problems instead of one big one.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 5 day summary` |
| 2 | HTTP > Make a request | `read the day and the interview` |
| 3 | Anthropic Claude > Create a message | `write the day summary` |
| 4 | JSON > Parse JSON | `read Claude's reply` |
| 5 | Tools > Set multiple variables | `check the minutes` |
| 6 | HTTP > Make a request | `clear the old allocations` |
| 7 | HTTP > Make a request | `clear the old interview activities` |
| 8 | Flow control > Iterator | `each allocation` |
| 9 | Tools > Set variable | `the minutes for this row` |
| 10 | Supabase > Insert a row | `save one allocation` |
| 11 | Supabase > Insert a row | `save one activity` |
| 12 | Flow control > Array aggregator | `wait for every allocation` |
| 13 | Supabase > Update a row | `mark the check in summarised` |

---

### 1. Webhooks > Custom webhook

Name `Scout 5 day summary`. Data structure: `check_in_id`, Text, required.

Scenario four reaches it with `Make > Run a scenario`. If you use the newer
`Scenarios > Call a scenario` in scenario four instead, swap this module for
`Scenarios > Start scenario` with the same single input and change nothing
else.

### 2. HTTP > Make a request

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/rpc/scout_summary_context` |
| Method | `POST` |
| Headers | `apikey`: the service key. `Authorization`: `Bearer ` then the service key. `Content-Type`: `application/json` |
| Body type | Raw |
| Content type | JSON (application/json) |
| Request content | `{"p_check_in_id": "{{1.check_in_id}}"}` |
| Parse response | **Yes** |

Writing the body by hand is safe here, unlike in scenario four: a check in id
is a uuid and holds nothing that needs escaping.

Run this module once on its own before building anything after it, so make.com
learns the field names.

### 3. Anthropic Claude > Create a message

| Field | Value |
|---|---|
| Connection | `Scout Claude` |
| Model | as at the top of `make/specs/README.md` |
| Max tokens | 4000 |
| Temperature | 0.2 |
| System prompt | the whole of `prompts/03_day_summary.md`, pasted in |
| Messages | one message. Role `User`, Content `{{2.data.prompt_input}}` |

### 4. JSON > Parse JSON

Data structure `scout_day_summary`:

| Field | Type | |
|---|---|---|
| `allocations` | Array of Collection | |
| | `topic_name` | Text |
| | `label` | Text |
| | `in_role` | Boolean |
| | `minutes` | Number |
| | `evidence` | Text |
| `summary_text` | Text | |

`topic_name` is empty for work outside the role. That is how the model says
"this belongs to no topic", and module 10 turns it into a database null.

Put the retry route from the shared pattern on this module's error handler.

### 5. Tools > Set multiple variables

Three variables. Each one is written out in full, because variables set in the
same module cannot read each other.

| Name | Value |
|---|---|
| `alloc_total` | `{{sum(map(4.allocations; "minutes"))}}` |
| `alloc_diff` | `{{2.data.working_minutes - sum(map(4.allocations; "minutes"))}}` |
| `largest_label` | `{{get(first(sort(4.allocations; "desc"; "minutes")); "label")}}` |

`alloc_diff` is what the day is short by, and is normally 0. `largest_label` is
the row that absorbs it, because a five minute correction to a 230 minute block
changes nothing anyone can see, and the same correction to a 20 minute block
would be a quarter of it.

### Filter on the link from 5 to 6: `the minutes are close enough`

| Setting | Value |
|---|---|
| Condition | `{{abs(5.alloc_diff)}}` |
| Operator | Numeric: Less than or equal to |
| Value | `60` |

A model that is an hour out has misread the day, and nudging one row would hide
that rather than fix it. The run stops here and the run history says why, with
the check in left as it was. Rerun it, and if it happens twice add the
`make_errors` row from the shared pattern so there is a record.

### 6. HTTP > Make a request

Clears this check in's old allocations, so a second run replaces rather than
doubles.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/day_allocations?check_in_id=eq.{{1.check_in_id}}` |
| Method | `DELETE` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |

### 7. HTTP > Make a request

The same for the day's interview activities. Calendar and transcript activities
are left alone: they are what Scout was told, not what it worked out.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/activities?person_id=eq.{{2.data.person_id}}&day=eq.{{2.data.day}}&source=eq.interview` |
| Method | `DELETE` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |

### 8. Flow control > Iterator

Array: `{{4.allocations}}`. Everything from here to module 11 runs once per
allocation, normally five times.

### 9. Tools > Set variable

Name `row_minutes`. Value:

```
{{if(8.label = 5.largest_label; 8.minutes + 5.alloc_diff; 8.minutes)}}
```

The largest row takes the remainder. Every other row keeps what the model said.
Setting it once here keeps the expression out of the three places that need it.

### 10. Supabase > Insert a row

Table `day_allocations`.

| Column | Value |
|---|---|
| `check_in_id` | `{{1.check_in_id}}` |
| `person_id` | `{{2.data.person_id}}` |
| `day` | `{{2.data.day}}` |
| `topic_id` | `{{ifempty(first(map(2.data.topic_map; "topic_id"; "name"; 8.topic_name)); null)}}` |
| `label` | `{{8.label}}` |
| `in_role` | `{{8.in_role}}` |
| `minutes` | `{{9.value}}` |
| `percent` | `{{round((9.value / 2.data.working_minutes) * 10000) / 100}}` |
| `evidence` | `{{8.evidence}}` |
| `employee_adjusted` | `false` |

The `topic_id` expression looks up the name in `topic_map` and returns null
when there is no match, which is exactly the case for work outside the role.
If the Supabase module refuses an empty value on a uuid column, put a router
inside the loop instead: one route for `in_role` true that sets `topic_id`, one
for false that leaves the column out altogether.

`percent` is the minutes as a share of the working day, to two decimal places.

### 11. Supabase > Insert a row

Table `activities`. One row per allocation, so the day's history holds what
Scout concluded and not only what it was shown.

| Column | Value |
|---|---|
| `person_id` | `{{2.data.person_id}}` |
| `day` | `{{2.data.day}}` |
| `source` | `interview` |
| `title` | `{{8.label}}` |
| `description` | `{{8.evidence}}` |
| `minutes` | `{{9.value}}` |
| `starts_at`, `ends_at` | leave empty |
| `attendees` | leave empty, the column defaults to an empty list |

### 12. Flow control > Array aggregator

Source module: **8, the iterator**. Nothing needs to be mapped into it.

Without this module, everything after it runs once for every allocation, and
the check in would be updated five times. This collapses the loop back to one
bundle so module 13 runs once.

### 13. Supabase > Update a row

Table `check_ins`.

| Column | Value |
|---|---|
| `id` | `{{1.check_in_id}}` |
| `summary_text` | `{{4.summary_text}}` |
| `status` | `summarised` |

**This is the last module on purpose.** The interface polls the status and
draws the screen the moment it turns `summarised`. Set it before the
allocations are written and the employee sees an empty summary.

---

## What good looks like

For Elena's Friday, worked through with the answers in
`data/interview_script.md`. `data/interview_script.md` has the same table at
the bottom, which is what to check against.

| Label | In role | Minutes | Percent |
|---|---|---|---|
| Client delivery and workshops | yes | 60 | 12.5 |
| Client relationships | yes | 40 | 8.33 |
| Coaching juniors | yes | 60 | 12.5 |
| Internal meetings and administration | yes | 90 | 18.75 |
| Manual status reporting | **no** | 230 | 47.92 |
| | | **480** | |

"Manual status reporting" is nearly half of a day in a role whose document
expects none of it. That one row is the case the whole product makes, and it is
what scenario seven turns into a suggestion three weeks later.

## Before you call it done

- [ ] `select * from day_allocations where check_in_id = ...` gives one row per
      topic used plus the outside role rows, and the `minutes` add up to
      exactly 480.
- [ ] Every in role row has a `topic_id`. Every outside role row has
      `topic_id` null and `in_role` false.
- [ ] "Manual status reporting" is there, outside the role, at 150 minutes or
      more. With Elena's full answers it should be about 230.
- [ ] The label matches `known_outside_labels` character for character when the
      company has used it before. A new spelling means the model ignored rule 5
      of the prompt.
- [ ] `summary_text` is two plain sentences addressed to "you", with no mention
      of automation or performance.
- [ ] The check in's status is `summarised`.
- [ ] Run it twice on the same check in: the row counts do not change, and
      there are no duplicate interview activities for the day.
- [ ] The blueprint is exported to `make/blueprints/` and holds no key, token
      or webhook address.

## If Claude keeps getting the minutes wrong

The prompt already tells it to check the sum. If it still drifts:

1. Look at what the run history actually sent it. An interview where the
   employee contradicted themselves is a harder sum than the model can do.
2. Widen the filter on the link from 5 to 6 from 60 to 90 for the rehearsal,
   and put it back before the demo.

Never move the arithmetic into the prompt. The employee can correct any number
on the summary screen before submitting, which is the real safety net and one
worth pointing at during the demo.
