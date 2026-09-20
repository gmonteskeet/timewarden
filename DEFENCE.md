# Defence

What the code scanner found on Workflow Scout, what we fixed, what we left and why. Written for the judges, in plain words.

The Quality Clouds Norma scan was run on Sunday 20 September 2026 over the 23 files that hold the logic: every route handler, the session and data helpers, and the three command line scripts. Norma reported **131 violations: 78 high, 51 medium, 2 low.** Eight of the 23 files came back clean. The full list, with Norma's own messages and line numbers, is in the scan report that goes with this pull request.

## Fixed

Fixed: js-no-error-handling-async in frontend/app/demo/reset/route.ts
Fixed: js-no-error-handling-async in frontend/app/enter/[token]/route.ts
Fixed: js-no-error-handling-async in frontend/app/demo/enter/[personId]/route.ts

## Left

Left: js-no-error-handling-async in frontend/app/api/check-in/[id]/status/route.ts
Left: js-no-error-handling-async in frontend/app/api/check-in/[id]/submit/route.ts
Left: js-no-error-handling-async in frontend/app/api/check-in/[id]/turn/route.ts
Left: js-no-error-handling-async in frontend/app/api/manager/candidates/[id]/route.ts
Left: js-no-error-handling-async in frontend/app/api/manager/candidates/[id]/decide/route.ts
Left: js-no-error-handling-async in frontend/app/api/manager/days/decide/route.ts
Left: js-no-error-handling-async in frontend/app/api/manager/roles/[id]/approve/route.ts
Left: js-no-error-handling-async in frontend/app/api/manager/suggestions/review/route.ts
Left: js-no-error-handling-async in frontend/app/demo/enter/[personId]/route.ts
Left: js-no-error-handling-async in frontend/app/enter/[token]/route.ts
Left: js-no-error-handling-async in frontend/lib/session.ts
Left: js-no-error-handling-async in frontend/lib/make.ts
Left: ts-generic-secret-assignment in frontend/lib/session.ts
Left: js-mnt-double-negation in frontend/lib/make.ts
Left: js-no-error-handling-async in scripts/reset_demo.mjs
Left: js-fetch-no-timeout in scripts/reset_demo.mjs
Left: js-console-log-only in scripts/reset_demo.mjs
Left: js-scl-await-in-loop in scripts/reset_demo.mjs
Left: js-no-error-handling-async in scripts/set_scout8_token.mjs
Left: js-fetch-no-timeout in scripts/set_scout8_token.mjs
Left: js-console-log-only in scripts/set_scout8_token.mjs
Left: js-mnt-double-negation in scripts/set_scout8_token.mjs
Left: js-no-error-handling-async in scripts/seed.mjs
Left: js-console-log-only in scripts/seed.mjs
Left: js-mng-loopback-url in scripts/seed.mjs
Left: rct-open-redirect in scripts/seed.mjs

## Why

js-no-error-handling-async in frontend/app/api/check-in/[id]/status/route.ts: the flagged await is `ctx.params`, which Next.js hands the route and which cannot reject, and the real call after it is already inside a try that ends in errorResponse.

js-no-error-handling-async in frontend/app/api/check-in/[id]/submit/route.ts: both flagged awaits are `ctx.params` and `readJson`, and readJson already catches its own errors and returns null.

js-no-error-handling-async in frontend/app/api/check-in/[id]/turn/route.ts: the same two awaits, neither of which can reject, with the interview call already guarded.

js-no-error-handling-async in frontend/app/api/manager/candidates/[id]/route.ts: the flagged await is `ctx.params`, and the lookup after it is already guarded.

js-no-error-handling-async in frontend/app/api/manager/candidates/[id]/decide/route.ts: the same two awaits that cannot reject, with the decision call already guarded.

js-no-error-handling-async in frontend/app/api/manager/roles/[id]/approve/route.ts: the same two awaits that cannot reject, with the approval call already guarded.

js-no-error-handling-async in frontend/app/api/manager/days/decide/route.ts: the flagged await is `readJson`, which returns null rather than throwing.

js-no-error-handling-async in frontend/app/api/manager/suggestions/review/route.ts: the flagged await is `readJson`, which returns null rather than throwing.

js-no-error-handling-async in frontend/app/demo/enter/[personId]/route.ts: the one finding left is `ctx.params`, which Next.js supplies and which cannot reject.

js-no-error-handling-async in frontend/app/enter/[token]/route.ts: the one finding left is `ctx.params`, which Next.js supplies and which cannot reject.

js-no-error-handling-async in frontend/lib/session.ts: catching around `cookies()`, `getSession()` and `requireSession()` would swallow the redirect that Next.js carries out by throwing, which would break the guard rather than harden it.

js-no-error-handling-async in frontend/lib/make.ts: all eight findings are the fixtures mode `pause()`, a setTimeout promise that cannot reject, while the one real network call in that file already has a try, a timeout, a status check and a JSON parse guard.

ts-generic-secret-assignment in frontend/lib/session.ts: the value is a deliberate placeholder used only when the app is running on sample data with no SESSION_SECRET set, a real secret always wins over it, and running on real data without one throws, so replacing it with a random value would only sign judges out between requests.

js-mnt-double-negation in frontend/lib/make.ts: it is cosmetic and low, and we are not touching working code during a freeze for a style point.

js-mnt-double-negation in scripts/set_scout8_token.mjs: the same, and that file belongs to Gerson.

js-no-error-handling-async in scripts/reset_demo.mjs: the script already stops on every database refusal through its own `call` helper and belongs to Gerson, whose ownership of scripts/ is set in AGENTS.md.

js-fetch-no-timeout in scripts/reset_demo.mjs: it is a command line tool a person runs and watches, not a screen that can freeze on a spinner.

js-console-log-only in scripts/reset_demo.mjs: the rule is written for a browser app, and this script's whole job is to print a readable report to a terminal.

js-scl-await-in-loop in scripts/reset_demo.mjs: the calls are sequential on purpose, because a role's shares must add up to 100 and writing them at the same time would break that rule half way through.

js-no-error-handling-async in scripts/set_scout8_token.mjs: the whole script already ends in a single `main().catch()` that reports the failure and points at the backup it saved.

js-fetch-no-timeout in scripts/set_scout8_token.mjs: the same reason as the other script, a person runs it and watches it.

js-console-log-only in scripts/set_scout8_token.mjs: the same reason, and 28 of these findings are the plain English report it prints to the person running it.

js-no-error-handling-async in scripts/seed.mjs: every database call is already checked through the script's own `check` helper, which stops the run and says what failed.

js-console-log-only in scripts/seed.mjs: the same reason as the other scripts.

js-mng-loopback-url in scripts/seed.mjs: the localhost address is the fallback for NEXT_PUBLIC_APP_URL in a developer script, and nothing in it ever reaches a browser.

rct-open-redirect in scripts/seed.mjs: both findings are false positives, because the thing Norma read as a navigation call is `Array.prototype.push` and no browser is involved.

### Choices Norma did not flag but a reviewer should know

**Personal links instead of passwords.** There are no passwords anywhere in Workflow Scout. Each person has one secret link, which arrives in their morning email; opening it sets a signed, http only session cookie holding who they are and whether they are a manager. We chose this because the product has to work in one tap from a phone at 08:00, and because a password nobody wants would be the reason people stop doing their check in. The trade off is real and we state it: anyone holding the link is that person until the cookie is cleared. What makes that acceptable here is that the link gives no more than the person's own days. Every server route checks the session before it reads anything: an employee can read and change only their own check ins, a manager only the people whose manager is them. For a real deployment the next step is one sign in through the company's own identity provider, with the link kept only as the way into a single day.

**The service key stays on the server and inside make.com, and the database has no public access.** Only two things ever hold the Supabase service key: our own Next.js server, and the make.com connections. The browser holds none of it: no database key, no webhook address, no voice key. Row level security is on across the database with no policies for the anonymous role, so a key that did leak into a page would still read nothing. Every read the server makes is filtered by who is signed in, in one place rather than screen by screen. We chose the service key over per user database credentials because the agent itself is a make.com scenario rather than a signed in person, and two keys for one job is how keys get left in the wrong place.

### One thing we could not do

`register_applied_actions` did not succeed. The three fixes were sent to it as a full report and Norma replied `{"status": "failed", "reason": "unlinked", "message": "Link a repository first with link_repository before reporting applied actions."}`. The repository cannot be linked from this machine: `link_repository` answers `auto_import_not_available` for both the HTTPS and the SSH form of the remote, and `get_open_issues` answers `no_linked_repository`. The rules, the scan and the checks after the fix all ran normally through the same server. Registering the three fixes is a one call job once the repository is imported from the Quality Clouds portal.
