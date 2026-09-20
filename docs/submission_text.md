# Submission form answers, ready to paste

Drafted at 12:05 on Sunday 20 September. Every claim here matches what was tested live this morning. Replace the three items in square brackets before pasting.

## Project name
Workflow Scout

## One line
An agent that lives inside a company, interviews people about their working day, and tells you which make.com workflow to build next, and what it is worth.

## Short description (about 50 words)
Workflow Scout compares what each role is for with where people's time really goes. It interviews employees about their last working day, lets them correct the result, and after the manager's approval it ranks the work most worth automating, priced from real cost rates. One click creates a draft scenario in make.com.

## Full description (about 150 words)
Building an automation is easy now. Knowing which one to build next is not. Workflow Scout answers that from evidence.

It starts from three things every company has for each role: the job description, its performance measures and its cost rate. From those it proposes how the role's time should split, and the manager approves. Each day Scout interviews the employee about their last working day. It already knows their calendar and recorded calls, so it only asks about what it cannot explain. The employee sees expected against actual time, corrects their own day and submits. Nothing reaches the manager before that: this finds work to automate, it does not judge people.

After the manager approves, Scout reviews weeks of approved days across the team, ranks what is furthest from each role and costs the most, and on approval creates a real draft scenario in make.com for a person to finish.

## Challenges entered
make.com, Quality Clouds (Production Ready, Norma), Galtea.

## How it addresses the make.com challenge
make.com asked for an agent that finds automation use cases inside a company, with a regular check in by voice or text, structured interview questions, continuous capture, prioritisation and human approval. All of the reasoning runs in make.com scenarios calling Claude: proposing and approving each role's time split, the turn by turn interview (Claude decides each next question and when it knows enough), the day summary, the three week review that ranks candidates, and the decision scenario, which fills a template and creates a real draft scenario through the make.com API, switched off, for a person to finish. Two human approvals are built in: the employee sends their own day, and the manager approves the day and the suggestion. Employees can answer by typing or by browser speech.

## How it addresses the Quality Clouds challenge
We scanned the logic of the app with Norma: 131 violations across 23 files. We fixed the ones that were real risks in the sign in and reset routes, and DEFENCE.md in the repository lists every finding we left and the reason, in plain words.

## How it addresses the Galtea challenge
We evaluated the interviewer, our most important AI step, with Galtea: 22 hand written cases covering prompt injection, requests to reveal its instructions, questions about colleagues, attempts to make it judge the employee, and empty or distressed answers. Galtea found that one raw reply in three arrived wrapped in a code fence (our live scenarios already strip that, which we confirmed with a live run), and that Scout handled questions about colleagues and instruction requests poorly. We fixed those with four new prompt rules and reran the failing cases: the injection and instruction cases now pass. Full numbers, impact and honest notes are in docs/galtea_findings.md.

## Links
- Live demo: https://workflow-scout.vercel.app (use the demo sign in on the home page, no password needed)
- Repository: https://github.com/gmonteskeet/workflow-scout [must be public before submitting]
- Video: [YouTube link, unlisted]
- Galtea dashboard: https://platform.galtea.ai/product/product_yvss08ok9ot0mgiwhadfnk9d

## Team
Marcus Rodrigues (product, interface, data, prompts) and Gerson Montesinos (make.com, database, deployment). [check the spelling of both names and add emails if the form asks]

## Tech used
make.com (eight webhooks designed, five scenarios live), Anthropic Claude through make.com, Next.js on Vercel, Supabase, Galtea, Quality Clouds Norma.

## What is sample data, said plainly
The company, the people, the calendar and the call transcripts are made up. The role documents were loaded at set up rather than read live from a document store, and the morning email link is not built: both are next steps.
