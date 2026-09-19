# Connections and secrets: what Gerson creates by hand

Task G3. Nothing here is written down in the repository. Every value below lives
either inside make.com or in `frontend/.env.local` on the machine that needs it.

Tick each line as you finish it.

## 1. Folder and naming in make.com
- [ ] Create a folder called `Workflow Scout`. Every scenario goes in it.
- [ ] Create a second folder called `Workflow Scout drafts`. The approval
      scenario drops the generated draft scenarios in here. Note its numeric id,
      you need it in task G12.

## 2. Anthropic Claude connection
- [ ] App: `Anthropic Claude`. Connection name: `Scout Claude`.
- [ ] Key comes from Marcus. Ask him for it directly, do not let it near the
      repository or a chat that is logged.
- [ ] Test it with a throwaway scenario: one "Create a message" module, model
      `claude-sonnet-4-5`, prompt "Reply with the word ready". Delete the
      scenario afterwards.
- [ ] If the account offers a newer Sonnet model, use that instead and write the
      model name in `docs/decisions.md`.

## 3. Google Calendar connection
- [ ] App: `Google Calendar`. Connection name: `Scout Calendar`.
- [ ] Sign in with the Google account that holds the calendar called
      `Scout demo: Elena Ruiz`.
- [ ] Grant read access at least. Read only is enough, we never write events.
- [ ] Open the calendar's settings in Google Calendar and copy its calendar id
      (it looks like an email address). That value goes into the `people` row
      for Elena Ruiz, in `data/people.json`. Send it to Marcus.
- [ ] Test: a throwaway scenario with "Search events" over 14 to 18 September
      2026 returns her week. Delete the scenario afterwards.

## 4. Supabase connection
- [ ] App: `Supabase`. Connection name: `Scout Supabase`.
- [ ] Project URL: the one from the Supabase dashboard.
- [ ] Key: the **service role** key, not the anon key. make.com writes to the
      database, so it needs the key that ignores row level security.
- [ ] Test: "Select rows" on `companies` returns Brightline Advisory after the
      seed script has run.

## 5. make.com API token
Needed by the approval scenario in task G12, which creates a real draft scenario
through the make.com API.

- [ ] In make.com, open your profile, then API access, then create a token named
      `Scout draft creator`.
- [ ] Scopes: `scenarios:read`, `scenarios:write`, `teams:read`,
      `connections:read`, `hooks:read`. If the form is a long list of tick
      boxes, tick every read scope plus `scenarios:write`.
- [ ] Note your zone address. It is the first part of the address bar when you
      are logged in, for example `https://eu2.make.com`. The API lives at
      `<zone>/api/v2/...`.
- [ ] Note your numeric team id. It is in the address bar when you open the team
      page, for example `/team/12345`.
- [ ] Store the token inside make.com as a data store value or a scenario
      variable, not in the repository.

## 6. Shared secret
- [ ] Make one random value, at least 32 characters. Generate it with
      `openssl rand -hex 24`.
- [ ] This is `SCOUT_SHARED_SECRET`. The interface sends it as the header
      `x-scout-key` on every webhook call, and the first filter in every
      scenario rejects anything that does not match.
- [ ] It goes in two places: `frontend/.env.local` (and the Vercel environment
      variables) and inside make.com as the value the filter compares against.

## 7. What to send Marcus, and how
Send these by direct message, never in the repository, never in a pull request.

Now:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key, safe for the browser)
- [ ] `SCOUT_SHARED_SECRET`
- [ ] Elena Ruiz's Google calendar id, for `data/people.json`

Once the scenarios exist, after tasks G7, G8, G9 and G12:
- [ ] `MAKE_WEBHOOK_VOICE`
- [ ] `MAKE_WEBHOOK_ANSWER`
- [ ] `MAKE_WEBHOOK_VERDICT`
- [ ] `MAKE_WEBHOOK_DECISION`

Webhook addresses count as secrets. Anyone who has one can post data into the
database. Task G17 sweeps the repository and every exported blueprint for them.

## 8. Which key goes where
| Value | Browser | Vercel server | make.com | Repository |
|---|---|---|---|---|
| Supabase project URL | yes | yes | yes | no |
| Supabase anon key | yes | yes | no | no |
| Supabase service role key | never | yes, for the seed script only | yes | no |
| Anthropic key | never | never | yes | no |
| make.com API token | never | never | yes | no |
| Shared secret | never | yes | yes | no |
| Webhook addresses | never | yes | n/a | no |

The browser never holds the service key, the Anthropic key or a webhook address.
It talks to Supabase with the anon key for reading, and to our own server routes
for everything else.
