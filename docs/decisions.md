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
