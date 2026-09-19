# One page brief: make.com challenge (draft 3, agreed 19 September 2026, 14:40)

## The challenge, in make.com's words
Find use cases for automation and AI agents in a corporate environment. Intake should be a daily voice drop plus structured interview questions. Analysis can look at repetitiveness, business need or reliability. Capture continuously, discover, prioritise. Build a sophisticated agent with sub-scenarios and human approval in the background. Bonus: additional, scalable intake methods.

## Our solution in one sentence
A plug and play agent that lives inside a company, listens to how people say they spend their time, checks that against what their calendar and call transcripts show, compares both with what their job says they should be doing, and turns the biggest gaps into ranked, ready to approve make.com workflows.

## How it works
1. Set up once. The company loads its people, their job descriptions and their performance criteria.
2. See (the bonus intake, built in make.com). Two objective sources:
   - Calendar: how long each meeting was, the topic, who it was with, and the agenda where one is attached.
   - Transcripts from a recording tool such as Granola: what was actually discussed, including unplanned calls that never appear in the calendar.
3. Listen (the required intake, built in make.com). Each employee leaves a short voice note, daily or weekly. The agent transcribes it, then asks structured follow up questions. The skill is in what it chooses to ask. It asks about three kinds of unknowns:
   - Meetings it cannot explain: "What was the purpose of the 90 minute 'Sync' on Tuesday?"
   - Gaps in the calendar: "Wednesday 13:00 to 17:00 is empty. What did you work on?"
   - Mismatches: "You said most of your week was client work, but your calendar shows eleven hours of internal reporting."
4. Analyse. Each activity is scored on time cost, repetitiveness, reliability risk, and distance from the person's job description and performance criteria. Results roll up by person, team and company.
5. Prioritise. A ranked list of automation candidates, each with hours saved and a plain reason for its rank.
6. Review and approve (the human approval step). One view, "said versus seen": where the person said their time went, what the calendar and transcripts show, and where they differ. The employee sees and corrects their own view first. The manager then sees the agreed version, agrees or disagrees with each finding, and approves one automation candidate.
7. Draft. The agent creates a real first draft workflow in the make.com account.

## What is ours that others will not have
- Ranking by the gap between the job a person is paid to do and the work they actually do, not just by what is repetitive.
- Sources that check each other: what people say, what the calendar shows, what the transcripts show.
- An interviewer that knows what it does not know, and asks about exactly that.

## What we build by Sunday midday
- In make.com: the agent, its sub-scenarios (calendar intake, transcript intake, voice intake, interview, scoring, draft workflow creation) and the human approval step.
- Our own interface: the "said versus seen" view, the ranked list, agree or disagree, approve.
- One made up company with realistic calendar, transcript and voice note data, and one demo story from voice note to draft workflow.

## What we show but do not build
Email, messages and screen activity intake, multi company roll out, and tracking whether an automation delivered its savings.

## Cut order if time runs short
First to go: transcript intake (keep it in the pitch). Second: roll up by team and company (show one person well). Never cut: voice note, interview questions, human approval, draft workflow in make.com.

## Guard rail for the pitch
The "said versus seen" view is for finding work to automate, not for judging people. The employee corrects their own view first. Say this out loud in the pitch.
