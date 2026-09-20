# Resetting the demo

## The one command

From the repository root:

```
node --env-file=frontend/.env.local scripts/reset_demo.mjs
```

To show the suggestions being found from nothing, add `--clear-candidates`:

```
node --env-file=frontend/.env.local scripts/reset_demo.mjs --clear-candidates
```

## When to run it

Before every judging round, and after any rehearsal that got as far as the
interview. It takes a few seconds and is safe to run again if you are not sure
whether you already have.

Which of the two to use:

- **Without the flag** for a safe demo. The suggestions stay in the database and
  go back to "proposed", so the Suggestions screen already has something to show
  even if the review is skipped or make.com is slow.
- **With the flag** when you want to show Scout finding the suggestions live.
  The screen starts empty and fills when the manager asks for a review. That is
  the better story, and the riskier one.

## What it does

1. Elena's check in for the demo day goes back to "invited": the interview, the
   allocations and the activities Scout worked out are deleted, and the summary
   text, the submitted time and the approval are cleared.
2. Her calendar entries and the recorded call for that day stay. They are what
   Scout is told, not what it concluded, and the interview needs them.
3. The three weeks of approved history for Elena, Priya and Jonas stay exactly
   as they are. The suggestions are built from those.
4. Every role goes back to a proposed split, and each topic's expected share
   goes back to the share the AI first proposed, so the manager can approve a
   split again.
5. Approvals are deleted, and suggestions are either kept and set back to
   "proposed" with any draft link cleared, or deleted with the flag.

It prints what it changed, with counts.

## What it does not do

- **It never touches make.com.** Draft scenarios created in earlier rounds stay
  in the folder "Workflow Scout drafts". Delete them by hand between rounds if
  you would rather the folder were empty, or leave them: they do nothing.
- It does not reseed the database. If the demo data itself is wrong, run
  `node scripts/seed.mjs` first and then this.
- It does not touch Priya's or Jonas's days. Only Elena has a live check in for
  the demo day.

## Giving scenario 8 its token

Scenario eight records the manager's decision and has Claude fill the draft
template, but the last step, the one that creates the draft scenario in
make.com, needs a make.com API token. No assistant has ever had that token and
none should: you add it yourself, in your own terminal.

```
node scripts/set_scout8_token.mjs
```

It asks for the token with the echo switched off, so it never appears on
screen. The token is held in memory, used against the make.com API, and written
into one header inside the scenario in make.com, which is where every other
credential in this project lives. It is never printed, never logged and never
written to a file.

What it does, in order:

1. Finds the scenario named `Scout 8: Decision and draft creation`.
2. Saves its current blueprint to `../make_backups/`, outside this repository,
   because that file holds keys.
3. Adds the last steps: build the draft blueprint, build the schedule, build
   the make.com request, create the draft scenario in the folder
   `Workflow Scout drafts`, save the draft on the suggestion, and reply with the
   link. If those steps are already there with an empty header, it only fills
   the header.
4. Reads the scenario back and says whether the step is there and whether the
   header is set, without printing the header.

To see what it would do without a token:

```
node scripts/set_scout8_token.mjs --dry-run
```

**To undo:** open the backup file the script names, copy the blueprint, and
paste it over the scenario in the make.com editor: the three dots, then Import
Blueprint.

Once it has run, approving a suggestion creates a real draft scenario, switched
off, and the link appears on the Suggestions screen. Until then, approving a
suggestion records the decision and leaves it at "approved", and the demo shows
the draft that is already in the folder.
