# Scout 3a: Calendar intake

Reads one person's real Google Calendar for one day and writes it into
`activities`. Everything downstream, the interview and the summary, reads the
database and never touches Google.

**Trigger:** started by `Scout 3: Morning run`, which waits for it
**Folder:** `Workflow Scout`

Read `make/specs/README.md` first for the shared pattern. There is no shared
secret filter here: this is a sub scenario, not something the interface calls.

**Build this one first of all of G8.** It is four modules, and with a check in
row it is everything `Scout 4: Interview turn` needs to be testable.

## Before it can work

`data/people.json` has `calendar_id: null` for all four people, and this
scenario skips anyone without one. Do this first, from
`make/specs/00_connections.md` section 4:

1. Copy the calendar id of `Scout demo: Elena Ruiz` from its settings in Google
   Calendar. It looks like an email address.
2. Send it to Marcus for `data/people.json`, and set it on Elena's row in the
   live database now so you are not waiting on a merge:
   `update people set calendar_id = '...' where full_name = 'Elena Ruiz';`
3. Check `data/elena_week.ics` is loaded into that calendar. Friday 18
   September should show five events: the steering group at 11:00, the weekly
   review at 13:00, the report send out at 14:00, coaching Jonas at 16:30 and
   planning at 17:30.

There is deliberately **nothing** in the calendar between 09:00 and 11:00, and
nothing for the 09:20 call from Sophie Lindqvist. That call only exists as a
transcript, and that gap is what makes Scout ask its first question.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 3a calendar intake` |
| 2 | HTTP > Make a request | `clear that day's calendar activities` |
| 3 | Google Calendar > Search events | `read the day` |
| 4 | Supabase > Insert a row | `save one event` |

### 1. Webhooks > Custom webhook

Data structure:

| Field | Type | Required |
|---|---|---|
| `person_id` | Text | yes |
| `day` | Text | yes, as `YYYY-MM-DD` |
| `calendar_id` | Text | no |

Scenario three passes `calendar_id` along so this scenario does not have to
look the person up again.

### Filter on the link from 1 to 2: `this person has a calendar`

| Setting | Value |
|---|---|
| Condition | `{{1.calendar_id}}` |
| Operator | Text: Exists |

Tomas has no calendar and neither will Priya or Jonas on the day. They stop
here quietly, and scenario three still invites them, which is what we want.

### 2. HTTP > Make a request

Clears the day first, so running the morning routine twice replaces rather than
doubles. Only `calendar` rows go: transcript and interview rows belong to other
scenarios.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/activities?person_id=eq.{{1.person_id}}&day=eq.{{1.day}}&source=eq.calendar` |
| Method | `DELETE` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |

### 3. Google Calendar > Search events

| Field | Value |
|---|---|
| Connection | `Scout Calendar` |
| Calendar | `{{1.calendar_id}}` |
| Start date | `{{1.day}}T00:00:00+02:00` |
| End date | `{{1.day}}T23:59:59+02:00` |
| Order by | start time |
| Limit | 50 |

`+02:00` is Madrid in September. If you ever run this outside summer time, the
offset is `+01:00`. Writing the date and a fixed time like this is the one
place make.com is happy with a joined up timestamp, because only the date part
moves.

This module gives out **one bundle per event**, so module 4 runs once for each
one on its own. No iterator is needed.

### 4. Supabase > Insert a row

Table `activities`.

| Column | Value |
|---|---|
| `person_id` | `{{1.person_id}}` |
| `day` | `{{1.day}}` |
| `source` | `calendar` |
| `title` | `{{3.summary}}` |
| `description` | `{{3.description}}` |
| `starts_at` | `{{3.start}}` |
| `ends_at` | `{{3.end}}` |
| `minutes` | `{{round((3.end - 3.start) / 60000)}}` |
| `attendees` | `{{map(3.attendees; "displayName")}}` |

Two things to check on the first run, because Google's field names vary by
module version:

- If `3.start` comes through as a collection rather than a date, use
  `{{3.start.dateTime}}` and `{{3.end.dateTime}}` in all three places.
- If `attendees` come back with no `displayName`, use `{{map(3.attendees;
  "email")}}`. The names are only there to help Claude recognise a client
  meeting, so either works.

Subtracting two dates in make.com gives milliseconds, which is why the minutes
are divided by 60000.

## Before you call it done

- [ ] Run it by hand with Elena's `person_id`, `2026-09-18` and her calendar
      id. Five rows appear in `activities`.
- [ ] `select title, starts_at, minutes from activities where day = '2026-09-18'
      and source = 'calendar' order by starts_at;` gives the steering group at
      11:00 for 60, the weekly review at 13:00 for 60, the report send out at
      14:00 for **150**, coaching at 16:30 for 60 and planning at 17:30 for 30.
- [ ] There is nothing between 09:00 and 11:00. If something is there, the
      wrong calendar is loaded.
- [ ] Run it twice. Still five rows, not ten.
- [ ] A person with no `calendar_id` stops at the filter and the run is green,
      not failed.
- [ ] The blueprint is exported and holds no calendar id, key or address.
