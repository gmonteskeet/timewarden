# One page brief: make.com challenge (version 4, after the make.com mentor session, 19 September 2026)

## The challenge, in make.com's words
Find use cases for automation and AI agents in a corporate environment. Intake should be a daily voice drop plus structured interview questions. Analysis can look at repetitiveness, business need or reliability. Capture continuously, discover, prioritise. Build a sophisticated agent with sub-scenarios and human approval in the background. Bonus: additional, scalable intake methods.

## Our solution in one sentence
Workflow Scout learns from each role's job description how time should be spent, interviews every employee each morning about how their last working day was actually spent, and turns the lasting gaps between the two into make.com workflows that a manager can approve with one click.

## How it works, as the users see it
There are two kinds of user: manager and employee.

1. **Set up (manager).** A make.com scenario reads one document per role, holding the job description and performance measures, from the company's document store (SharePoint, Google Drive or similar). The AI proposes an expected split of time by topic for each role, for example "Client delivery 45 percent, coaching juniors 10 percent". The manager adjusts and approves each split.
2. **Every morning (make.com).** For each employee, make.com reads the previous working day's calendar and recorded call transcripts, then emails a personal link.
3. **The check in (employee).** The link opens an interview that starts immediately, spoken or typed. Scout already knows the calendar and the calls, so it asks only about what it cannot explain: "Your calendar was empty between 09:00 and 11:00. What were you working on?" It asks follow up questions until it is confident how the day divides across the role's topics, then stops. Six questions at most.
4. **The summary (employee).** Always the same picture: one bar per topic, expected long term share beside the actual share for the day, with time outside the role shown separately. The employee corrects anything that is wrong and submits.
5. **Approval (manager).** The manager approves submitted days for the team, daily or weekly.
6. **Over time (make.com and manager).** Scout reviews the approved history, finds time that keeps going to work outside people's roles, and suggests make.com workflows to take it over, ranked by time cost, repetitiveness, reliability risk and distance from the role. The manager approves one and a real draft scenario appears in make.com.

## How this answers the brief
- Daily voice drop and structured interview: step 3.
- Capture continuously, discover, prioritise: steps 2, 3 and 6.
- Angles of analysis: repetitiveness, reliability and, our own addition, distance from the role.
- Sophisticated agent with sub-scenarios: ten make.com scenarios, one agent that calls them.
- Human approval in the background: three of them. The role split, the day, and the suggested workflow.
- Bonus intake methods: calendar, call transcripts and the role documents themselves.

## What is ours that others will not have
- The expected split per role, derived from the job description and approved by a manager. It turns "what is repetitive" into "what is pulling people away from the job they were hired to do".
- An interviewer that knows what it does not know, and asks only about that.
- Suggestions that come from weeks of approved, employee confirmed data, not from one person's guess.

## What we build by Sunday midday
- In make.com: the scenarios for role documents and splits, split approval, the morning run with calendar and transcript intake, the interview turn, the day summary, submit and approval, the suggestion review, and decision and draft creation.
- Our own web app: light login for manager and employee, roles and splits, the interview, the standard summary, manager approvals, suggestions.
- One made up company, Brightline Advisory, with four role documents, a real Google Calendar, call transcripts, and three weeks of pre-loaded approved history. One live day: Friday 18 September.

## What we show but do not build
Email, chat and screen activity as further intake. Passwords and company wide administration. Several companies. Tracking whether an approved automation delivered its savings. Flagging when a role document changes after its split was approved.

## Cut order if time runs short
SLNG voice first, then transcript intake, the employee's own history page, reading role documents live, the weekly approval view, and sending the morning email live. Never cut: the interview, the expected against actual summary, employee submit and manager approval, and the suggestion that becomes a real draft in make.com.

## Guard rail for the pitch
This is for finding work to automate, not for judging people. The employee sees and corrects their day first, and the manager sees it only after the employee submits. Say this out loud.
