# Scout 3: Morning run

Every weekday morning, for each employee: read their last working day from the
calendar and their recorded calls, open a check in, and email them a personal
link. This is where the product starts from the person's point of view.

**Trigger:** weekdays 07:30, and the webhook `MAKE_WEBHOOK_MORNING_RUN`
**Folder:** `Workflow Scout`

Read `make/specs/README.md` first for the shared pattern, and build
`03a_calendar_intake.md` and `03b_transcript_intake.md` before this one.

## Build it in two halves

Modules 1 to 8 put the day in the database. Module 9, the email, is **sixth in
the cut order** in `AGENTS.md` section 9.

Get the first half working and `Scout 4: Interview turn` becomes testable
immediately, because it finally has a check in row to read. Add the email
after. If the email will not behave on the day, open the link from
`docs/demo_links.md` by hand and show the judges this scenario instead. The
story survives that; it does not survive a missing check in.

## Modules

| # | App and module | Name it |
|---|---|---|
| 1 | Webhooks > Custom webhook | `Scout 3 morning run` |
| 2 | Tools > Set variable | `the day we are asking about` |
| 3 | Supabase > Select rows | `everyone who checks in` |
| 4 | Make > Run a scenario | `read the calendar` |
| 5 | Make > Run a scenario | `read the calls` |
| 6 | HTTP > Make a request | `open a check in, without disturbing one already going` |
| 7 | HTTP > Make a request | `find that check in` |
| 8 | Flow control > Array aggregator | `wait for everybody` |
| 9 | Gmail > Send an email | `send the morning link` |
| 10 | Webhooks > Webhook response | `answer the interface` |

Module 9 sits between 7 and 8, inside the per person run. The numbering follows
the order you build them, not the order on the canvas.

### 1. Webhooks > Custom webhook

Switch on **Get request headers**. Data structure:

| Field | Type | Required |
|---|---|---|
| `company_id` | Text | yes |
| `day` | Text | no, as `YYYY-MM-DD` |

The address is `MAKE_WEBHOOK_MORNING_RUN`. A secret, so send it to Marcus by
direct message.

For the 07:30 schedule, add a second trigger route or a separate scheduled copy
of this scenario. `day` arrives empty on the schedule and module 2 works it out.

### Filter on the link from 1 to 2: `only our own interface`

As in `04_interview_turn.md`: ``{{1.headers.`x-scout-key`}}`` Text: Equal to
the `SCOUT_SHARED_SECRET`.

### 2. Tools > Set variable

Name `the_day`. Value:

```
{{ifempty(1.day; if(formatDate(now; "dddd") = "Monday"; formatDate(addDays(now; -3); "YYYY-MM-DD"); formatDate(addDays(now; -1); "YYYY-MM-DD")))}}
```

When the interface sends a day, that day is used. When the schedule runs it, it
is yesterday, or Friday when today is Monday. Checking the day by name rather
than by number avoids arguing about whether the week starts on Sunday.

For the demo, Marcus's interface sends `2026-09-18`, because the demo is on a
Sunday and Friday is the story. `NEXT_PUBLIC_DEMO_DAY` holds the same date.

### 3. Supabase > Select rows

Table `people`. Filter: `company_id` equals `{{1.company_id}}` **and**
`app_role` equals `employee`. Select `id, full_name, email, calendar_id,
access_token`.

Three bundles: Elena, Priya and Jonas. Tomas is the manager and is left out, by
his `app_role`, not by name. Everything from here to module 9 runs once per
person.

### 4. Make > Run a scenario

| Setting | Value |
|---|---|
| Scenario | `Scout 3a: Calendar intake` |
| Wait until the scenario is finished | **Yes** |
| Body | `{"person_id": "{{3.id}}", "day": "{{2.value}}", "calendar_id": "{{3.calendar_id}}"}` |

Waiting matters here, unlike in scenario four. The check in must not be opened
before the day's activities are in place, or the employee could click their
link and be interviewed about an empty day.

Somebody with no `calendar_id` is skipped inside 3a and this still returns
green.

### 5. Make > Run a scenario

`Scout 3b: Transcript intake`, wait **Yes**, body
`{"person_id": "{{3.id}}", "day": "{{2.value}}"}`.

If 3b is cut, delete this module and nothing else changes.

### 6. HTTP > Make a request

Opens the check in. The important part is the `Prefer` header: an existing row
is left completely alone, so somebody who is halfway through their interview at
07:30 is not thrown back to the start.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/check_ins?on_conflict=person_id,day` |
| Method | `POST` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key. `Content-Type`: `application/json`. `Prefer`: `resolution=ignore-duplicates,return=representation` |
| Body type | Raw, content type JSON |
| Request content | `{"person_id": "{{3.id}}", "day": "{{2.value}}", "status": "invited"}` |
| Parse response | **Yes** |

The reply is an array holding the new row, or an empty array when there was
already a check in for that person and day. That is how module 10 counts what
it actually created.

This is the one place the build file's "never overwrite one that has moved past
`invited`" is enforced, and it is enforced by the database rather than by a
branch in make.com, which is one fewer thing to get wrong at 07:30.

### 7. HTTP > Make a request

Module 6 tells you nothing when the row already existed, and the email needs
the check in id either way.

| Setting | Value |
|---|---|
| URL | `<SUPABASE_URL>/rest/v1/check_ins?person_id=eq.{{3.id}}&day=eq.{{2.value}}&select=id,status` |
| Method | `GET` |
| Headers | `apikey` and `Authorization: Bearer `, both the service key |
| Parse response | **Yes** |

The id is `{{7.data[1].id}}`. Arrays in make.com count from 1.

### 9. Gmail > Send an email

| Field | Value |
|---|---|
| Connection | `Scout Mail` |
| To | `{{3.email}}` |
| Subject | `Tell Scout about your last working day` |

Body, plain text. British spelling, no em dashes, nothing in it only a machine
would understand:

```
Good morning {{first(split(3.full_name; " "))}},

I have your calendar and any recorded calls for {{formatDate(parseDate(2.value; "YYYY-MM-DD"); "dddd D MMMM")}}, and I would like to ask you a few questions about how the day went.

This is for finding work worth handing to a computer, not for judging anyone. Your manager sees the day only after you have looked at it and sent it on.

It takes about two minutes:
<APP_URL>/enter/{{3.access_token}}?next=/check-in/{{7.data[1].id}}

Scout
```

Three things to get right:

- `<APP_URL>` is the deployed address from task G14, the same value as
  `NEXT_PUBLIC_APP_URL`. On localhost the link opens nothing for anyone else.
- `access_token` is a secret: it is the whole of somebody's sign in, so it goes
  in the link and nowhere else, never in a log or a run history you screenshot.
- The privacy sentence is rule 12 of `AGENTS.md` and is not optional. Say it in
  the email as well as on the screen.

For the demo, Elena's address in the live database must be an inbox **Marcus
can open on stage**. Priya's and Jonas's can point at yours.

### 8. Flow control > Array aggregator

Source module: **3, the people select**. This collapses the three per person
runs back into one bundle so the reply is sent once rather than three times.

Aggregate two fields so module 10 can count:

| Field | Value |
|---|---|
| `created` | `{{if(length(6.data) > 0; 1; 0)}}` |
| `emailed` | `1` |

### 10. Webhooks > Webhook response

Status `200`, header `Content-Type: application/json`, body:

```
{"ok": true, "check_ins_created": {{sum(map(8.array; "created"))}}, "emails_sent": {{length(8.array)}}}
```

This matches `MorningRunReply` in `frontend/lib/contract.ts` and `AGENTS.md`
section 6. `check_ins_created` is genuinely the number opened, so running the
routine twice in a morning honestly reports 0 the second time.

Plain text is safe in this body: every value is a number.

## Before you call it done

- [ ] A request with no `x-scout-key` header stops at the filter.
- [ ] `{"company_id": "...", "day": "2026-09-18"}` returns
      `{"ok": true, "check_ins_created": 3, "emails_sent": 3}`.
- [ ] Three `check_ins` rows exist for 18 September, all `invited`. Tomas has
      none.
- [ ] Elena has five `calendar` activities and one `transcript` activity for
      that day.
- [ ] Run it a second time: the reply says `check_ins_created: 0`, the rows are
      unchanged and the activities are not doubled.
- [ ] Set one check in to `in_progress` by hand, run again, and confirm it is
      still `in_progress`. This is the rule that protects somebody mid
      interview.
- [ ] The email arrives, reads as plain English, and its link opens Elena's
      check in when clicked on a phone.
- [ ] **Now go back to `04_interview_turn.md`.** With these rows in place,
      scenario four can finally be tested end to end against
      `data/interview_script.md`.
- [ ] The blueprint is exported and holds no key, token, address or access
      token.
