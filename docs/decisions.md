# Decisions

Technical choices that differ from the build files, with the reason. Newest at
the bottom. Gerson has the final say on anything in here.

## 1. The repository stays private for now (task G1, 19 September)
`docs/BUILD_GERSON.md` task G1 says to confirm the repository is public. Gerson
decided to keep it private while we build. Marcus is already a collaborator, so
nothing about the working setup needs public access.

Open point for Sunday: if the judges are expected to browse the repository, it
has to be made public before we submit at 11:30. Add it to `docs/sunday.md` at
checkpoint two.

## 2. No branch protection on `main` (task G1, 19 September)
Task G1 asks for light protection on `main`: pull requests required, no review
required. GitHub does not offer branch protection or rulesets on private
repositories on the free plan, so this cannot be switched on while decision 1
stands.

What we do instead: the rule in `AGENTS.md` stays as written and we keep to it
by hand. One task, one branch, one pull request. Nobody pushes to `main`.

## 3. Unique constraints for the seed script (task G2, 19 September)
`AGENTS.md` section 5 lists the columns but no natural keys. Task G4 requires
the seed script to be idempotent, and an upsert needs something to match on.
Added: `companies(name)`, `people(company_id, full_name)` and
`transcripts(person_id, title, occurred_at)`.

## 4. Grants written out in the migration (task G2, 19 September)
A Supabase project grants `select` on new public tables to the anonymous role
by default. The migration states the grants anyway, so it runs correctly on a
plain Postgres database and can be tested without a Supabase project. Row level
security is still what refuses a write.

## 5. Decision 4 is superseded by version 2 (task G4, 19 September)
Version 2 has users and rights and no public read access. Migration `0002`
drops every public read policy and takes the grants in decision 4 back off the
anonymous role. Row level security stays on for every table with no policies at
all, so only the service key reaches the data.

Worth knowing: the anonymous role keeps `usage` on the `public` schema, because
that is granted to `PUBLIC` rather than to `anon` and taking it away would
affect every role. It does not matter. Checked on a real Postgres: with no
table grants the anonymous role is refused outright, and even when `select` is
granted back by hand, row level security with no policies returns zero rows.
Two locks, not one.

## 6. A role with no topics at all is allowed (task G4, 19 September)
Task G4 asks for a check that a role's `expected_percent` values add up to 100.
It is a deferred constraint trigger on `topics`, so the seed script and the
scenarios can delete a role's topics and write the new ones inside one
transaction.

make.com cannot do that. It replaces topics with a delete call followed by an
insert call, and those are two separate transactions, so the table is briefly
empty for that role. The trigger therefore allows a role with no topics and
only checks the total once topics exist. It also allows 0.01 either side of
100, because a proposed split can carry repeating decimals.

The gap this leaves: a scenario that deletes topics and then fails before
inserting leaves a role with none. Scenario one is written to insert straight
after, and `supabase/reset.sql` puts a clean split back.

## 7. The demo day is reset for everyone, not only Elena (task G4, 19 September)
Task G4 says `supabase/reset.sql` deletes Elena's check in for 18 September.
The morning routine creates a check in for every employee, so the script
deletes every check in for 18 September instead. Anything less would leave
Priya's and Jonas's half finished days behind on a second rehearsal. The three
weeks of history, which end on 17 September, are untouched.

## 8. Migration `0003` is the interview context, not `team_history` (task G7, 19 September)
`docs/BUILD_GERSON.md` task G11 says to create the `team_history` view in a
migration `0003`. Task G7 came first and needed a migration of its own, so
`0003_interview_context.sql` is the interview and summary context and
`team_history` becomes `0004` when G11 is built. Nothing else changes.

## 9. The interview context comes from one database function (task G7, 19 September)
Task G7 allows this: "Use one HTTP call to a Supabase view or RPC to fetch the
context in one go if separate selects are too slow." Scenario four has twelve
seconds for the whole run, and the check in, the person, the role, the topics,
the day's activities and the interview so far are six round trips before Claude
is even asked.

`public.scout_interview_context` and `public.scout_summary_context` do it in
one, and hand back `prompt_input`: the user message for the Claude module,
already written as JSON text with exactly the fields `prompts/README.md` lists.
make.com maps one field instead of eight, which also removes the commonest way
to break a prompt, a mistyped field name.

Measured on a local Postgres with the real demo data: 6 milliseconds.

## 10. The database function records the employee's answer (task G7, 19 September)
Task G7 lists "insert the employee turn" and "set the check in to in_progress"
as their own steps. They are folded into `scout_interview_context` instead,
because the model must see the answer it is replying to, so the insert has to
happen before the context is read. Doing it in one call rather than three saves
two round trips out of the twelve seconds.

Nothing that decides anything moved. The six question cap, the Claude call, the
branching, the arithmetic on the minutes and every other write are all still
make.com modules, and all still readable in the run history during the demo.

## 11. The three context functions are `security definer` (task G7, 19 September)
Checked on a real Postgres: with `security invoker`, the functions only work if
the calling role also holds grants on every table they touch. Supabase gives
`service_role` those grants, but the functions should not depend on it, and a
`security definer` function with a fixed `search_path` does not. Execute is
revoked from `public`, so only `service_role` can call them, and the anonymous
role is refused twice over: no execute on the function, and no usage on the
schema from decision 5.

## 12. A day allocation's `percent` can be 0.01 off 100 (task G7, 19 September)
`AGENTS.md` section 5 says a check in's percentages add up to 100. Scenario five
works each one out as `round(minutes / working_minutes * 10000) / 100`, two
decimal places, and rounding five or six of those can land on 99.99 or 100.01.

The minutes are exact, which is what the constraint is really protecting and
what the manager reads. Nothing depends on the percentages summing, there is no
database constraint on them, and giving the largest row the leftover hundredth
would need a second pass over the array in IML for a difference nobody can see.
For Elena's Friday the five rows come to exactly 100.00.

## 13. The scenarios are built through the make.com API, not by hand (task G7, 19 September)
Task G7 allows it: "If Gerson connects the make.com MCP server or gives you an
API token, you may build scenarios through the API, but ask him first." Gerson
gave the token at 18:25 on the Saturday, with the account still empty and the
20:00 checkpoint ninety minutes away.

`scripts/make_build.mjs` generates the blueprint and creates or updates the
scenario in place. No secret is in the file: the token, the Supabase address,
the service key and the shared secret all come from the environment, and the
placeholders say `REPLACE-ME` so a half built scenario cannot quietly point at
the wrong database. Re-running it after a value changes is one command.

The build sheets in `make/specs/` stay. They are what a human reads to
understand or repair a scenario, and task G17 still wants exported blueprints.

## 14. Supabase is reached over HTTP, not through the Supabase app (task G7, 19 September)
The sheets say to prefer the Supabase modules because they read clearly in the
run history. The account has no Supabase connection and building one needs the
project keys, which do not exist yet either.

The HTTP module needs no connection at all. Using it for every Supabase read
and write means the only connection scenario four needs is Anthropic Claude,
which takes the number of things blocking the checkpoint from two to one. The
run history is still readable: every HTTP module is named in plain English.

## 15. The Anthropic module has no system prompt field (task G7, 19 September)
Read from a real blueprint: `anthropic-claude:createAMessage` version 1 takes
`model`, `messages`, `max_tokens` and `temperature`. There is no `system`.

So each prompt file goes at the top of the user message with the input after
it. Claude treats it the same. The build sheets say so now.

## 16. The model is Make's own AI provider, not Anthropic Claude (task G7, 19 September)
`AGENTS.md` section 3 says the model is Anthropic Claude, called through
make.com's Anthropic app. There is no Anthropic key: the account had no
connections at all, and `make/specs/00_connections.md` section 2 expected the
key to come from Marcus, which was an assumption about who had credits rather
than a rule. Gerson has credits on make.com and chose at 19:00 to use Make's
own AI provider instead, so that nothing waits on a key.

What this changes: `ai-tools:Ask` version 2 replaces
`anthropic-claude:createAMessage`, the whole prompt goes in one `input` field,
and the model is whatever tier Make routes to rather than Sonnet. The prompts
are unchanged and still ask for JSON only.

`scripts/make_build.mjs` can build either. Set `MAKE_ANTHROPIC_CONNECTION` and
it goes back to Claude with no other change, so this is reversible the moment a
key appears.

**This needs Marcus to agree.** `AGENTS.md` is a shared file under rule 3, and
the change affects what the pitch can claim about the model. Two things to
watch: the prompts were written and worked through against Claude, so a
different model may follow the JSON rules less reliably, which makes the retry
route matter more than it did; and "Claude" should come out of any slide that
names it.

## 17. Back to Claude, and the model is `claude-sonnet-5` (task G7, 19 September)
Decision 16 put the interview on Make's own AI provider because there was no
Anthropic key. Gerson got one at about 23:20 and the connection `Scout Claude`
now exists in make.com, created through the API. Decision 16 is therefore
reversed: `AGENTS.md` section 3 stands unchanged and nothing needs to come out
of the pitch.

`make/specs/00_connections.md` section 2 says to take a newer Sonnet than
`claude-sonnet-4-5` if the module offers one, so the model is
**`claude-sonnet-5`**. `make/specs/README.md` needs the same edit.

It was worth the wait. On Make's provider the first question put the empty
block at 11:00 to 12:00, which is actually the Northmere steering group, and a
later turn asked about 12:00 to 13:00, which rule 2 of the prompt calls lunch
and forbids asking about. On `claude-sonnet-5` the first question named the
09:00 to 11:00 gap and Sophie Lindqvist's call, almost word for word like the
worked example in the prompt. It was also faster: 3.9 seconds against 10.1.

## 18. Two things make.com's own template gets wrong for the Anthropic module (task G7, 19 September)
Both found by reading the error off a failed run, and both would waste anyone's
evening:

- `messages[].content[]` needs `"type": "text"`. The public template make.com
  ships leaves it out and Anthropic answers
  `messages.0.content.0.type: Field required`.
- `max_tokens` and `temperature` must be numbers. The same template writes them
  as strings and Anthropic answers
  `max_tokens: Input should be a valid integer`.
