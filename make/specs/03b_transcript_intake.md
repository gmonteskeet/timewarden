# Scout 3b: Transcript intake

Turns one person's recorded calls for one day into `activities` rows, each with
a two sentence summary of what the call was about. These stand in for a
recording tool such as Granola.

**Trigger:** started by `Scout 3: Morning run`, which waits for it
**Folder:** `Workflow Scout`

No shared secret filter: a sub scenario, not something the interface calls.

**This is second in the cut order** (`AGENTS.md` section 9). If the afternoon
runs short, cut it and say in the pitch that Scout reads call transcripts,
because scenario four is written to cope with none. But cutting it costs you
the best moment in the demo, so cut it last of the things you are willing to
cut.

## Why it earns its place

Elena's 09:20 call from Sophie Lindqvist is not in her calendar. It is the
unplanned work, and it is the thing that explains why she spent the morning
fixing figures by hand. Without this scenario Scout sees a blank two hours and
asks a vaguer question, and the summary loses the evidence that makes "Manual
status reporting" land.

`in_calendar` false is what marks that work as unplanned.

## It must line up with the transcript row

`public.scout_day_context` in migration `0003` works out `in_calendar` by
matching an activity back to its transcript on `person_id` and
`occurred_at = starts_at`. So **`starts_at` on the activity must be exactly
`occurred_at` on the transcript**, to the second. Get that wrong and the
function falls back to checking whether a calendar entry covers the same
stretch, which for Elena's 09:20 call gives the right answer anyway, but only
by luck.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 3b transcript intake` |
| 2 | HTTP > Make a request | `clear that day's transcript activities` |
| 3 | HTTP > Make a request | `find the day's calls` |
| 4 | Flow control > Iterator | `each call` |
| 5 | Anthropic Claude > Create a message | `say what the call was about` |
| 6 | Supabase > Insert a row | `save one call` |

### 1. Webhooks > Custom webhook

| Field | Type | Required |
|---|---|---|
| `person_id` | Text | yes |
| `day` | Text | yes, as `YYYY-MM-DD` |

### 2. HTTP > Make a request

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/activities?person_id=eq.{{1.person_id}}&day=eq.{{1.day}}&source=eq.transcript` |
| Method | `DELETE` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |

### 3. HTTP > Make a request

`transcripts` has no `day` column, only `occurred_at`, so the day is a range.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/transcripts?person_id=eq.{{1.person_id}}&occurred_at=gte.{{1.day}}T00:00:00%2B02:00&occurred_at=lte.{{1.day}}T23:59:59%2B02:00&select=id,title,occurred_at,minutes,body` |
| Method | `GET` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |
| Parse response | **Yes** |

`%2B` is a `+` sign written for a web address. A bare `+` in a query string
means a space, and the filter silently matches nothing.

### 4. Flow control > Iterator

Array: `{{3.data}}`. For Elena on 18 September this runs once.

### 5. Anthropic Claude > Create a message

| Field | Value |
|---|---|
| Connection | `Scout Claude` |
| Model | as at the top of `make/specs/README.md` |
| Max tokens | 200 |
| Temperature | 0.2 |
| System prompt | see below |
| Messages | one message. Role `User`, Content `{{4.body}}` |

There is no file in `prompts/` for this one. It is two lines and it belongs to
the scenario, not to the product:

```
You are given the transcript of one work call. In two sentences, say what work was being done in it and who it was for. Write plainly, in British spelling, with no em dashes. Reply with the two sentences only, nothing else.
```

No Parse JSON module here: the reply is prose, not JSON, so there is nothing to
parse and nothing to retry.

### 6. Supabase > Insert a row

Table `activities`.

| Column | Value |
|---|---|
| `person_id` | `{{1.person_id}}` |
| `day` | `{{1.day}}` |
| `source` | `transcript` |
| `title` | `{{4.title}}` |
| `description` | `{{5.content[1].text}}` |
| `starts_at` | `{{4.occurred_at}}` |
| `ends_at` | `{{addMinutes(4.occurred_at; 4.minutes)}}` |
| `minutes` | `{{4.minutes}}` |
| `attendees` | leave empty |

`{{5.content[1].text}}` is where the Anthropic Claude module puts the reply.
Arrays in make.com count from 1, not 0. If your version of the module gives a
plain `result` or `text` field instead, use that.

`starts_at` is mapped straight from `occurred_at` and nothing else, for the
reason in the section above.

## Before you call it done

- [ ] Run it by hand with Elena's `person_id` and `2026-09-18`. One row appears.
- [ ] Its `description` is two sentences and mentions Sophie Lindqvist,
      Northmere Foods and figures that did not match. If it is one long
      paragraph, the system prompt did not save.
- [ ] `starts_at` is exactly `2026-09-18 09:20:00+02`, the same as
      `occurred_at` on the transcript row.
- [ ] Ask the database the question scenario four will ask:
      `select (public.scout_day_context(<check_in_id>) -> 'transcript_activities')
      -> 0 ->> 'in_calendar';` It must say `false`.
- [ ] Run it twice. Still one row.
- [ ] The blueprint is exported and holds no key or address.
