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
