# Submission text

Everything the submission form and the backup video need. Written Sunday 20 September 2026. Copy it straight out; do not rewrite it on the form.

## Description, 150 words

Building an automation has never been easier. The hard question has moved: what should a company automate next, and how do you prove it was worth it? Today it is answered by opinion.

Workflow Scout answers it with evidence. A make.com scenario reads each role's own document and proposes how that role's time should divide. Every morning it reads each person's calendar and recorded calls, then emails them a personal link. Scout interviews them about their last working day, asking only about what it cannot explain. They see their day as expected time against actual time, correct it and submit. Nothing reaches their manager until they do.

The manager approves the day, then asks Scout to review three weeks of approved days. Scout ranks the work worth automating, weighted by how far it sits from the job the person was hired for. One approval creates a real draft scenario in make.com.

## Description, 50 words

Workflow Scout finds what a company should automate next. It interviews each person about their working day, compares it with what their role is for, and ranks the work that keeps landing in the wrong place. One manager approval turns the top suggestion into a real draft scenario in make.com.

## How we used make.com

make.com is not a step in Workflow Scout, it is the agent. Every piece of thinking happens inside a make.com scenario: reading each role document from the company's document store and proposing a time split, reading calendars and call transcripts every weekday morning and emailing each person their link, running the interview one question at a time, adding the day up into the expected against actual summary, and reviewing three weeks of approved days to rank what is worth automating. The model is Anthropic Claude, called through the Anthropic Claude app inside make.com, and the scoring is arithmetic in the scenario rather than something we ask the model to guess. Our Next.js app only shows what the scenarios produce and posts back what the person decides. The last scenario closes the loop: when a manager approves a suggestion, it calls the make.com API and a real draft scenario appears in the account.

## Two minute demo video, shot list

Two minutes, seven shots. Record at 1440 by 900 in sample data mode so nothing depends on the network. Read the words underneath each shot as the shot plays. Keep the pace steady; the whole thing runs to about 300 words.

**Shot 1, 0:00 to 0:15. The home page, then the three step strip.**
"Every company hires people to do a job. Almost nobody ends up doing that job. Workflow Scout finds out where the time actually goes, and hands the difference to make.com."

**Shot 2, 0:15 to 0:35. Roles, signed in as Tomas. Scroll one role card, nudge one number, press Approve.**
"Tomas runs Client Delivery. A make.com scenario has read each role's own document and proposed how that role's time should divide. He is the yardstick, not the model, so he adjusts one number and approves."

**Shot 3, 0:35 to 1:05. The check in as Elena. Show the question, the line under it saying what Scout saw, then one answer sent and the next question arriving.**
"Elena got a link in her morning email. Scout already has her calendar and her recorded calls, so it only asks about what it cannot explain: two empty hours, and a block called Friday report send out. It stops itself after about five questions."

**Shot 4, 1:05 to 1:25. The summary. Point at the outside the role bar. Correct one row, then show the line saying the bars are hers. Press Submit.**
"Here is her day: what the role expects, against what happened. Nearly four hours went to manual status reporting, which is nowhere in her role. She corrects one number, and nothing reaches her manager until she submits it."

**Shot 5, 1:25 to 1:40. Approvals as Tomas. Approve Elena's day.**
"Tomas sees the day only now. He approves it."

**Shot 6, 1:40 to 1:50. Suggestions. Press Review the last three weeks, then show the ranked cards and the scores on card one.**
"Scout reviews three weeks of approved days and ranks what is worth automating: time, repetitiveness, reliability, and how far the work sits from the job. Top of the list, the weekly client status report. Seven hours a week across three people."

**Shot 7, 1:50 to 2:00. Approve it, show the draft ready panel, then the draft scenario open in make.com.**
"He approves it, and a real draft scenario is waiting in make.com."
