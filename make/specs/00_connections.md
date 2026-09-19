# Connections and secrets: what Gerson creates by hand

Task G5, version 2. Nothing here is written down in the repository. Every value
below lives either inside make.com or in `frontend/.env.local` on the machine
that needs it.

Version 2 has no public read access to the database. The browser never holds a
database key, a webhook address or the SLNG key. There is no anonymous Supabase
key in use any more.

Tick each line as you finish it.

## 1. Folders in make.com
- [ ] A folder called `Workflow Scout`. All eight scenarios go in it.
- [ ] A folder called `Workflow Scout drafts`. Scenario eight drops the
      generated draft scenarios in here. Note its numeric id, task G12 needs it.

## 2. Anthropic Claude connection
- [ ] App: `Anthropic Claude`. Connection name: `Scout Claude`.
- [ ] Key comes from Marcus. Ask him directly. It never goes near the
      repository.
- [ ] Note which model the module offers. Write the one you pick at the top of
      `make/specs/README.md`, as `AGENTS.md` section 3 asks. If it offers a
      newer Sonnet than `claude-sonnet-4-5`, take it and record it in
      `docs/decisions.md`.
- [ ] Test with a throwaway scenario: one "Create a message" module, prompt
      "Reply with the word ready". Delete the scenario afterwards.

## 3. Google Drive connection, for the role documents
This is what scenario one reads. It is the document store in the pitch.

- [ ] App: `Google Drive`. Connection name: `Scout Drive`.
- [ ] Create a folder in Drive called `Brightline Advisory role documents`.
- [ ] Upload the four files from `data/role_documents/` into it as Google Docs
      or as plain Markdown. Scenario one downloads each one converted to plain
      text, so either is fine.
- [ ] Note the folder id, from the address bar when the folder is open.
- [ ] Test: "Search for files" in that folder returns four files.

## 4. Google Calendar connection
- [ ] App: `Google Calendar`. Connection name: `Scout Calendar`.
- [ ] Sign in with the Google account holding the calendar
      `Scout demo: Elena Ruiz`. Read access is enough, we never write events.
- [ ] Load `data/elena_week.ics` into that calendar, so Friday 18 September has
      the events the interview asks about.
- [ ] Copy the calendar id from the calendar's settings. It looks like an email
      address. It goes in `data/people.json` for Elena. Send it to Marcus.
- [ ] Test: "Search events" for 18 September 2026, Europe/Madrid, returns her
      day, including the empty stretch between 09:00 and 11:00.

## 5. Email connection, for the morning message
- [ ] App: `Gmail`, connection `Scout Mail`. The make.com `Email` app is a fine
      substitute if Gmail gives trouble.
- [ ] The account must be one you can send from repeatedly without tripping a
      limit. Three emails per run, a handful of runs.
- [ ] Elena's address in the live database must be an inbox **Marcus can open on
      stage**. Priya's and Jonas's can point at your own.
- [ ] Test: send one message to Elena's demo inbox and open it.

## 6. Supabase connection
- [ ] App: `Supabase`. Connection name: `Scout Supabase`.
- [ ] Project URL from the Supabase dashboard.
- [ ] Key: the **service role** key. It is the only key that reaches the data
      now, because row level security is on with no policies at all.
- [ ] Test: "Select rows" on `companies` returns Brightline Advisory once the
      seed script has run.

## 7. make.com API token
Scenario eight uses this to create a real draft scenario, which is the ending of
the demo.

- [ ] Profile, then API access, then a token named `Scout draft creator`.
- [ ] Scopes: `scenarios:read`, `scenarios:write`, `teams:read`,
      `connections:read`, `hooks:read`. If the form is a long list of tick
      boxes, tick every read scope plus `scenarios:write`.
- [ ] Note your zone address, the start of the address bar when you are logged
      in, for example `https://eu2.make.com`. The API is at `<zone>/api/v2/...`.
- [ ] Note your numeric team id, from the address bar on the team page.
- [ ] Keep the token inside make.com, in a data store or a scenario variable.
      Never in the repository.

## 8. Secrets you generate
- [ ] `SCOUT_SHARED_SECRET`: `openssl rand -hex 24`. The interface sends it as
      the header `x-scout-key` on every webhook call and the first filter in
      every scenario refuses anything that does not match. It goes in
      `frontend/.env.local`, in Vercel, and inside make.com.
- [ ] `SESSION_SECRET`: `openssl rand -hex 32`. This signs the session cookie
      that the personal link sets. Server side only, never in make.com.
- [ ] `SLNG_API_KEY`: only if we get as far as the SLNG voice upgrade, which is
      first in the cut order. Server side only.

## 9. What to send Marcus, and how
By direct message. Never in the repository, never in a pull request.

Now:
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SCOUT_SHARED_SECRET`
- [ ] `SESSION_SECRET`
- [ ] Elena's Google calendar id, for `data/people.json`
- [ ] The demo inbox address for Elena

Once the scenarios exist:
- [ ] `MAKE_WEBHOOK_ROLES_SYNC`
- [ ] `MAKE_WEBHOOK_SPLIT_APPROVAL`
- [ ] `MAKE_WEBHOOK_MORNING_RUN`
- [ ] `MAKE_WEBHOOK_INTERVIEW`
- [ ] `MAKE_WEBHOOK_SUBMIT`
- [ ] `MAKE_WEBHOOK_DAY_APPROVAL`
- [ ] `MAKE_WEBHOOK_SUGGEST`
- [ ] `MAKE_WEBHOOK_DECISION`

Webhook addresses are secrets. Anyone holding one can write into the database.
So are the personal access tokens in `docs/demo_links.md`, which is in
`.gitignore` and stays there. Task G17 sweeps everything on Sunday morning.

## 10. Which value goes where
| Value | Browser | Next.js server | make.com | Repository |
|---|---|---|---|---|
| Supabase project URL | never | yes | yes | no |
| Supabase service role key | never | yes | yes | no |
| Anthropic key | never | never | yes | no |
| make.com API token | never | never | yes | no |
| Google Drive and Calendar access | never | never | yes | no |
| `SCOUT_SHARED_SECRET` | never | yes | yes | no |
| `SESSION_SECRET` | never | yes | never | no |
| `SLNG_API_KEY` | never | yes | never | no |
| Webhook addresses | never | yes | n/a | no |
| Personal access tokens | in the link only | yes | yes | no |

The browser only ever talks to our own server. That is the whole reason version
2 dropped public read access.

## 11. Swapping Google Drive for SharePoint
We default to Google Drive. The reason is in `docs/CHANGES_V2.md` decision 1:
connecting a hackathon account to an employer's Microsoft 365 usually needs an
administrator to approve it, and it would give a hackathon tool a route into a
firm's confidential documents.

If someone has a personal or trial Microsoft 365 account with nothing
confidential in it, the swap is small. **Only the first two modules of scenario
one change. Nothing else in the build is affected.**

| Google Drive | Microsoft 365 SharePoint |
|---|---|
| `Google Drive` > "Search for files", in the role documents folder | `Microsoft SharePoint` > "List files in a folder", in the document library |
| `Google Drive` > "Download a file", converting to plain text | `Microsoft SharePoint` > "Download a file", then a text extraction step if the file is not already plain text |

Everything downstream reads a file name and a block of text, so it does not
care where they came from. Keep the connection named `Scout Documents` either
way and the rest of the sheet reads the same.

In the pitch we say "SharePoint, Google Drive or any document store", and this
table is the honest reason we can.
