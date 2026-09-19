// Fake data in the contract shape, used when NEXT_PUBLIC_USE_FIXTURES=true.
// The source of the demo data is data/ at the repository root. The JSON files in lib/fixture-data/
// are copies, refreshed with: node frontend/scripts/sync-fixture-data.mjs
// Access tokens here (demo-elena and so on) are readable fake values, not secrets.

import historyFile from './fixture-data/history.json';
import splitsFile from './fixture-data/expected_splits.json';
import peopleFile from './fixture-data/people.json';
import {
  totalScore,
  WORKING_WEEKS_PER_YEAR,
  type Candidate,
  type CheckIn,
  type Company,
  type DayAllocation,
  type InterviewTurn,
  type Person,
  type ProposedStep,
  type Role,
  type Topic,
  type TurnKind,
} from './contract';

type RoleKey = keyof typeof splitsFile;

interface HistoryAllocation {
  topic_name: string | null;
  label: string;
  in_role: boolean;
  minutes: number;
  percent: number;
  evidence: string;
  employee_adjusted: boolean;
}
interface HistoryCheckIn {
  person_key: string;
  day: string;
  status: string;
  approved_by_key: string;
  summary_text: string;
  allocations: HistoryAllocation[];
}

export const DEMO_DAY = '2026-09-18';
export const HISTORY_START = '2026-08-31';
export const HISTORY_END = '2026-09-17';
const HISTORY_WORKING_DAYS = 14;
const CREATED = '2026-09-18T07:30:00+02:00';

// ---------------------------------------------------------------------------
// Company, roles and topics
// ---------------------------------------------------------------------------

export const company: Company = { id: 'c-brightline', name: 'Brightline Advisory', created_at: CREATED };

const roleText: Record<RoleKey, { title: string; job_description: string; kpis: string[] }> = {
  senior_client_consultant: {
    title: 'Senior Client Consultant',
    job_description:
      'Leads Brightline\'s work with a small portfolio of client accounts: designs and runs client workshops, turns what is learned into clear recommendations, owns the day to day relationship with each client\'s senior team, supports proposals and coaches the consultants and analysts on each account.',
    kpis: [
      'At least 70 percent of working time spent on client facing work.',
      'At least two client workshops delivered per month, each rated 4 out of 5 or higher by attendees.',
      'Two client proposals supported per quarter.',
      'Every client recommendation accepted or actioned within 60 days of delivery.',
      'Client satisfaction score of 8 out of 10 or higher on each account.',
    ],
  },
  head_of_client_delivery: {
    title: 'Head of Client Delivery',
    job_description:
      'Runs the Client Delivery team: sets priorities across all engagements, leads and develops the consultants and analysts, keeps delivery profitable and on budget, acts as the senior contact for each client and leads the team\'s contribution to new business.',
    kpis: [
      'Team utilisation of 75 percent or higher on billable client work.',
      'Every client engagement delivered within 10 percent of its agreed budget.',
      'Client retention of 90 percent or higher across the year.',
      'Four new or extended engagements won per year.',
      'Every team member has a development plan reviewed each quarter.',
    ],
  },
  consultant: {
    title: 'Consultant',
    job_description:
      'Works alongside a Senior Client Consultant on two or three client accounts: researches the client\'s current processes, prepares workshop materials, captures what is agreed and drafts the first version of recommendations, building towards leading client workshops.',
    kpis: [
      'Workshop materials ready at least two working days before each session.',
      'First draft of recommendations delivered within five working days of a workshop.',
      'Co-lead at least one client workshop per month.',
      'Positive feedback from the lead consultant on each engagement.',
      'Complete the firm\'s facilitation training within the first year in role.',
    ],
  },
  business_analyst: {
    title: 'Business Analyst',
    job_description:
      'Analyses client data to find where processes lose time and money, builds the models behind recommendations, supports consultants with data, including a small part supporting project reporting, and presents findings to clients in plain terms.',
    kpis: [
      'Analysis delivered for every recommendation before it goes to the client.',
      'Every model documented so another analyst can rerun it.',
      'At least one client presentation of findings per month.',
      'Data questions from consultants answered within two working days.',
      'No material errors found by the client in any figures the Business Analyst has checked.',
    ],
  },
};

// One sentence of the AI's reasoning per topic, as the role split scenario would give it.
const topicReasoning: Record<string, string> = {
  'Client delivery and workshops': 'Workshops and recommendations are the role\'s first responsibility and drive the measures on workshop ratings and recommendations actioned.',
  'Client relationships': 'Owning each client relationship underpins the client satisfaction score of 8 out of 10.',
  'Proposals and business development': 'The role must support two client proposals per quarter, which needs a steady share of each week.',
  'Coaching juniors': 'The role document asks for a fortnightly coaching session with each consultant and analyst on the accounts.',
  'Team leadership and people management': 'Leading the team and reviewing development plans each quarter is the role\'s first responsibility.',
  'Client relationships and escalations': 'Client retention of 90 percent depends on the senior contact being present when it matters.',
  'Delivery oversight and quality': 'Keeping every engagement within 10 percent of budget needs regular review of plans and budgets.',
  'New business and proposals': 'Winning four new or extended engagements a year needs a steady share of time on proposals.',
  'Client research and analysis': 'Understanding the client\'s current processes is the groundwork the role exists to provide.',
  'Workshop preparation and support': 'Materials must be ready two working days before each session, and the role co-leads workshops.',
  'Drafting recommendations': 'First drafts are due within five working days of each workshop.',
  'Learning and development': 'The role is building towards leading workshops and must complete facilitation training.',
  'Data analysis and modelling': 'Analysis behind every recommendation is the core of the role.',
  'Supporting consultants with data': 'Data questions from consultants must be answered within two working days.',
  'Client presentations of findings': 'The role presents findings to a client at least once a month.',
  'Documenting models': 'Every model must be documented so another analyst can rerun it.',
  'Internal meetings and administration': 'Team meetings and records are expected, but the role\'s measures keep this share small.',
};

const roleKeys = Object.keys(splitsFile) as RoleKey[];

export const roles: Role[] = roleKeys.map((key) => ({
  id: `r-${key}`,
  company_id: company.id,
  title: roleText[key].title,
  document_name: roleText[key].title,
  document_url: null,
  job_description: roleText[key].job_description,
  kpis: roleText[key].kpis,
  split_status: 'proposed',
  split_approved_by: null,
  split_approved_at: null,
  source_read_at: '2026-09-18T07:00:00+02:00',
  created_at: CREATED,
}));

export const topics: Topic[] = roleKeys.flatMap((key) =>
  splitsFile[key].map((t) => ({
    id: `t-${key}-${t.sort_order}`,
    role_id: `r-${key}`,
    name: t.name,
    description: t.description,
    expected_percent: t.expected_percent,
    proposed_percent: t.expected_percent,
    reasoning: topicReasoning[t.name] ?? '',
    sort_order: t.sort_order,
    created_at: CREATED,
  })),
);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const people: Person[] = peopleFile.map((p) => ({
  id: `p-${p.key}`,
  company_id: company.id,
  role_id: `r-${p.role_key}`,
  full_name: p.full_name,
  email: p.email,
  app_role: p.app_role as Person['app_role'],
  team: p.team,
  manager_id: p.manager_key ? `p-${p.manager_key}` : null,
  hourly_cost_eur: p.hourly_cost_eur,
  calendar_id: p.calendar_id,
  access_token: `demo-${p.key}`,
  working_minutes_per_day: p.working_minutes_per_day,
  created_at: CREATED,
}));

const personId = (key: string) => `p-${key}`;
const checkInId = (key: string, day: string) => `ci-${key}-${day}`;

function topicIdFor(personKey: string, topicName: string | null): string | null {
  if (!topicName) return null;
  const person = people.find((p) => p.id === personId(personKey));
  return topics.find((t) => t.role_id === person?.role_id && t.name === topicName)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Three weeks of approved history, 31 August to 17 September 2026
// ---------------------------------------------------------------------------

const history = historyFile.check_ins as HistoryCheckIn[];

const historyCheckIns: CheckIn[] = history.map((h) => ({
  id: checkInId(h.person_key, h.day),
  person_id: personId(h.person_key),
  day: h.day,
  status: 'approved',
  invited_at: `${h.day}T07:30:00+02:00`,
  submitted_at: `${h.day}T17:45:00+02:00`,
  approved_by: personId(h.approved_by_key),
  approved_at: `${h.day}T18:30:00+02:00`,
  manager_comment: null,
  summary_text: h.summary_text,
  created_at: `${h.day}T07:30:00+02:00`,
}));

const historyAllocations: DayAllocation[] = history.flatMap((h) =>
  h.allocations.map((a, i) => ({
    id: `da-${h.person_key}-${h.day}-${i + 1}`,
    check_in_id: checkInId(h.person_key, h.day),
    person_id: personId(h.person_key),
    day: h.day,
    topic_id: topicIdFor(h.person_key, a.topic_name),
    label: a.label,
    in_role: a.in_role,
    minutes: a.minutes,
    percent: a.percent,
    evidence: a.evidence,
    employee_adjusted: a.employee_adjusted,
    created_at: `${h.day}T17:45:00+02:00`,
  })),
);

// ---------------------------------------------------------------------------
// The live demo day: Friday 18 September 2026
// ---------------------------------------------------------------------------

export const ELENA_FRIDAY_ID = checkInId('elena', DEMO_DAY);

const fridayCheckIns: CheckIn[] = [
  {
    id: ELENA_FRIDAY_ID,
    person_id: personId('elena'),
    day: DEMO_DAY,
    status: 'summarised',
    invited_at: '2026-09-19T07:30:00+02:00',
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    manager_comment: null,
    summary_text:
      'Most of your in role time on Friday went to Northmere Foods, with Sophie Lindqvist\'s call and the steering group, plus coaching Jonas and the weekly team review. You spent 230 minutes, just under four hours, on manual status reporting: fixing two figures in last week\'s pack and the Friday report send out.',
    created_at: '2026-09-19T07:30:00+02:00',
  },
  ...(['priya', 'jonas'] as const).map<CheckIn>((key) => ({
    id: checkInId(key, DEMO_DAY),
    person_id: personId(key),
    day: DEMO_DAY,
    status: 'invited',
    invited_at: '2026-09-19T07:30:00+02:00',
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    manager_comment: null,
    summary_text: null,
    created_at: '2026-09-19T07:30:00+02:00',
  })),
];

/** Elena's Friday interview, word for word from data/interview_script.md. */
const elenaFridayTurns: Omit<InterviewTurn, 'id' | 'check_in_id' | 'created_at'>[] = [
  {
    turn_no: 1,
    speaker: 'scout',
    text: 'Good morning Elena, thanks for taking a few minutes to tell me about Friday. Your calendar was empty from 09:00 to 11:00, two hours, and I can see the 40 minute call from Sophie Lindqvist at Northmere Foods at 09:20, so what were you working on for the rest of that time?',
    kind: 'calendar_gap',
    evidence: 'Nothing in your calendar from 09:00 to 11:00. One unplanned 40 minute call with Northmere Foods was recorded at 09:20.',
  },
  {
    turn_no: 2,
    speaker: 'employee',
    text: 'From nine I was checking figures for today\'s status pack. Then Sophie rang at twenty past about two figures in last week\'s pack that didn\'t match the tracker, and that call took 40 minutes. After it, until eleven, I corrected both figures, added a note explaining the change and sent her the new version. So 40 minutes on the call and the rest, about 80 minutes, on fixing the status pack.',
    kind: null,
    evidence: null,
  },
  {
    turn_no: 3,
    speaker: 'scout',
    text: 'On Friday from 14:00 to 16:30, two and a half hours, you had Friday report send out; what does that involve?',
    kind: 'elaboration',
    evidence: 'Calendar: Friday report send out, 14:00 to 16:30, no other attendees.',
  },
  {
    turn_no: 4,
    speaker: 'employee',
    text: 'That\'s the weekly status pack for my three accounts. I copy the hours and spend from the project tracker export into the slides by hand, check them against the budget sheet and the resourcing sheet, fix the formatting, and then email it to eight client contacts across Northmere Foods, Kestrel Point Logistics and Ashvale Housing Trust. It\'s the full two and a half hours, and it happens every single Friday.',
    kind: null,
    evidence: null,
  },
  {
    turn_no: 5,
    speaker: 'scout',
    text: 'Of the nearly four hours on the status pack on Friday, 09:00 to 11:00 apart from the call and 14:00 to 16:30, how much was hands on copying, and does it happen every week?',
    kind: 'elaboration',
    evidence: 'About 230 minutes on the status pack on Friday: 80 in the morning and 150 in the afternoon.',
  },
  {
    turn_no: 6,
    speaker: 'employee',
    text: 'Nearly all of it is hands on copying and checking. The Friday send out is every week, and on Mondays I spend about an hour starting the next pack.',
    kind: null,
    evidence: null,
  },
  {
    turn_no: 7,
    speaker: 'scout',
    text: 'Thank you, Elena, that gives me a clear picture of Friday and your summary is ready.',
    kind: 'closing',
    evidence: '',
  },
];

const interviewTurns: InterviewTurn[] = elenaFridayTurns.map((t) => ({
  ...t,
  id: `it-elena-${DEMO_DAY}-${t.turn_no}`,
  check_in_id: ELENA_FRIDAY_ID,
  created_at: '2026-09-19T08:05:00+02:00',
}));

/** Percents to one decimal place, with the largest row adjusted so the total is exactly 100. */
export function withPercents<T extends { minutes: number }>(rows: T[], totalMinutes: number): (T & { percent: number })[] {
  const out = rows.map((r) => ({ ...r, percent: Math.round((r.minutes / totalMinutes) * 1000) / 10 }));
  if (out.length === 0) return out;
  const gapTenths = 1000 - out.reduce((s, r) => s + Math.round(r.percent * 10), 0);
  const largest = out.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  largest.percent = Math.round(largest.percent * 10 + gapTenths) / 10;
  return out;
}

const elenaFridayRows: Omit<DayAllocation, 'percent'>[] = [
  { topic: 'Client delivery and workshops', minutes: 60, evidence: 'Calendar: Northmere Foods steering group, 11:00 to 12:00.' },
  { topic: 'Client relationships', minutes: 40, evidence: 'Recorded call: Sophie Lindqvist of Northmere Foods rang at 09:20 for 40 minutes.' },
  { topic: 'Coaching juniors', minutes: 60, evidence: 'Calendar: coaching session with Jonas Weber, 16:30 to 17:30.' },
  { topic: 'Internal meetings and administration', minutes: 90, evidence: 'Calendar: Client Delivery weekly review, 13:00 to 14:00, and planning next week, 17:30 to 18:00.' },
  { topic: null, label: 'Manual status reporting', minutes: 230, evidence: 'Interview: 80 minutes fixing two figures in last week\'s status pack in the morning, and the Friday report send out from 14:00 to 16:30, copying figures from the project tracker into slides and emailing eight client contacts.' },
].map((r, i) => ({
  id: `da-elena-${DEMO_DAY}-${i + 1}`,
  check_in_id: ELENA_FRIDAY_ID,
  person_id: personId('elena'),
  day: DEMO_DAY,
  topic_id: topicIdFor('elena', r.topic),
  label: r.topic ?? r.label ?? '',
  in_role: r.topic !== null,
  minutes: r.minutes,
  evidence: r.evidence,
  employee_adjusted: false,
  created_at: '2026-09-19T08:06:00+02:00',
}));

const fridayAllocations: DayAllocation[] = withPercents(elenaFridayRows, 480);

export const checkIns: CheckIn[] = [...historyCheckIns, ...fridayCheckIns];
export const dayAllocations: DayAllocation[] = [...historyAllocations, ...fridayAllocations];
export { interviewTurns };

// ---------------------------------------------------------------------------
// Scripted interview for fixtures mode: what Scout says at each step.
// ---------------------------------------------------------------------------

export interface ScriptedScoutLine {
  question: string;
  kind: TurnKind;
  evidence: string;
}

const genericScript: ScriptedScoutLine[] = [
  {
    question: 'Thanks for checking in; which part of your last working day took most of your time?',
    kind: 'opening',
    evidence: 'Your calendar for the day is loaded.',
  },
  {
    question: 'Thank you, that gives me a clear picture of the day and your summary is ready.',
    kind: 'closing',
    evidence: '',
  },
];

/** The Scout lines, in order, for a check in. Elena's Friday uses her scripted interview. */
export function scoutScriptFor(checkInIdValue: string): ScriptedScoutLine[] {
  if (checkInIdValue === ELENA_FRIDAY_ID) {
    return elenaFridayTurns
      .filter((t) => t.speaker === 'scout')
      .map((t) => ({ question: t.text, kind: t.kind as TurnKind, evidence: t.evidence ?? '' }));
  }
  return genericScript;
}

// ---------------------------------------------------------------------------
// Four suggested workflows, ranked with the scoring formula from AGENTS.md
// ---------------------------------------------------------------------------

interface CandidateSeed {
  title: string;
  description: string;
  source_label: string;
  scores: [number, number, number, number];
  reasoning: string;
  proposed_steps: ProposedStep[];
}

const candidateSeeds: CandidateSeed[] = [
  {
    title: 'Weekly client status report',
    description:
      'Every Friday, pull hours and spend for each client account from the project tracker and budget sheet, write a short status summary per account, and prepare the emails to client contacts as drafts for a person to check and send.',
    source_label: 'Manual status reporting',
    scores: [4, 5, 4, 5],
    reasoning:
      'Elena Ruiz, Priya Nair and Jonas Weber spend about 6.9 hours a week between them copying figures from the project tracker into the client status pack, with Elena alone spending about 2.9 hours on Mondays and Fridays. The steps are the same every week and are not part of any of their roles, so a workflow could prepare the pack and give that time back to client work.',
    proposed_steps: [
      { app: 'Google Sheets', action: 'Search rows', note: 'Read this week\'s hours per client account from the project tracker export.' },
      { app: 'Google Sheets', action: 'Search rows', note: 'Read spend against budget per account from the budget sheet.' },
      { app: 'Anthropic Claude', action: 'Create a message', note: 'Write a short status summary per account: hours, spend, milestones and what is needed from the client.' },
      { app: 'Gmail', action: 'Create a draft', note: 'One draft per client account, addressed to its contacts, for a person to check and send.' },
    ],
  },
  {
    title: 'Timesheet reconciliation check',
    description:
      'Every Monday, compare hours in the resourcing sheet with the project tracker for each account and post any mismatches for the team to fix.',
    source_label: 'Timesheet reconciliation',
    scores: [2, 5, 3, 4],
    reasoning:
      'Elena Ruiz, Priya Nair and Jonas Weber each spend 45 minutes every Monday matching hours between the resourcing sheet and the project tracker, about 2.4 hours a week in total. It is the same comparison every week, so a workflow could find the mismatches and leave only the fixes to people.',
    proposed_steps: [
      { app: 'Google Sheets', action: 'Search rows', note: 'Read last week\'s hours per person and account from the resourcing sheet.' },
      { app: 'Google Sheets', action: 'Search rows', note: 'Read the same hours from the project tracker export.' },
      { app: 'Slack', action: 'Create a message', note: 'Post a list of mismatches to the Client Delivery channel, with the person and account for each.' },
    ],
  },
  {
    title: 'Answers to routine data questions',
    description:
      'When a consultant asks a routine question about hours or spend in the team channel, look the figure up in the project tracker and reply with it, leaving harder questions to the analyst.',
    source_label: 'Supporting consultants with data',
    scores: [4, 3, 2, 2],
    reasoning:
      'Jonas Weber spends about 7.3 hours a week supporting consultants with data, and some of those questions are simple look ups in the project tracker. This work is part of the role, so the gain is smaller, but a workflow could answer the routine questions straight away.',
    proposed_steps: [
      { app: 'Slack', action: 'Watch public channel messages', note: 'Pick up questions posted in the Client Delivery channel.' },
      { app: 'Anthropic Claude', action: 'Create a message', note: 'Decide whether the question is a simple look up and which figure it needs.' },
      { app: 'Google Sheets', action: 'Search rows', note: 'Find the figure in the project tracker export.' },
      { app: 'Slack', action: 'Create a message', note: 'Reply in the thread with the figure and where it came from.' },
    ],
  },
  {
    title: 'First drafts of model documentation',
    description:
      'When a model file is saved in the analysis folder, write a first draft of its documentation for the analyst to check and finish.',
    source_label: 'Documenting models',
    scores: [3, 3, 2, 2],
    reasoning:
      'Jonas Weber spends about 3.7 hours a week documenting models so another analyst can rerun them. Documentation is part of the role and needs judgement, so a workflow could only save the first draft, not the whole task.',
    proposed_steps: [
      { app: 'Google Drive', action: 'Watch files in a folder', note: 'Notice new or changed model files in the analysis folder.' },
      { app: 'Anthropic Claude', action: 'Create a message', note: 'Draft documentation: inputs, steps, assumptions and how to rerun the model.' },
      { app: 'Google Docs', action: 'Create a document', note: 'Save the draft next to the model for the analyst to finish.' },
    ],
  },
];

const historyWeeks = HISTORY_WORKING_DAYS / 5;

function candidateFromSeed(seed: CandidateSeed): Omit<Candidate, 'rank'> {
  const rows = historyAllocations.filter((a) => a.label === seed.source_label);
  const minutesByPerson = new Map<string, number>();
  for (const r of rows) minutesByPerson.set(r.person_id, (minutesByPerson.get(r.person_id) ?? 0) + r.minutes);
  const teamMinutes = [...minutesByPerson.values()].reduce((s, m) => s + m, 0);
  // annual_cost_eur = sum over affected people of (their hours per week * 46 * their hourly cost)
  const annual = [...minutesByPerson.entries()].reduce((sum, [id, minutes]) => {
    const cost = people.find((p) => p.id === id)?.hourly_cost_eur ?? 0;
    return sum + (minutes / 60 / historyWeeks) * WORKING_WEEKS_PER_YEAR * cost;
  }, 0);
  const [score_time, score_repetitive, score_reliability, score_role_distance] = seed.scores;
  return {
    id: `cand-${seed.source_label.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    company_id: company.id,
    title: seed.title,
    description: seed.description,
    source_label: seed.source_label,
    people_affected: minutesByPerson.size,
    hours_per_week: Math.round((teamMinutes / 60 / historyWeeks) * 10) / 10,
    annual_cost_eur: Math.round(annual),
    period_start: HISTORY_START,
    period_end: HISTORY_END,
    score_time,
    score_repetitive,
    score_reliability,
    score_role_distance,
    total_score: totalScore({ score_time, score_repetitive, score_reliability, score_role_distance }),
    reasoning: seed.reasoning,
    proposed_steps: seed.proposed_steps,
    status: 'proposed',
    make_scenario_id: null,
    make_scenario_url: null,
    created_at: '2026-09-19T08:30:00+02:00',
  };
}

export const candidates: Candidate[] = candidateSeeds
  .map(candidateFromSeed)
  .sort((a, b) => b.total_score - a.total_score)
  .map((c, i) => ({ ...c, rank: i + 1 }));

/** Made up address returned only after a candidate is approved in fixtures mode. */
export function fixtureDraftUrl(candidateId: string): string {
  return `https://eu1.make.com/fixtures-demo/draft-scenario/${candidateId}`;
}

/** The person each demo sign in lands on by default. */
export function fixtureLandingPath(person: Person): string {
  if (person.app_role === 'manager') return '/manager/roles';
  const open = fridayCheckIns.find((c) => c.person_id === person.id);
  return open ? `/check-in/${open.id}` : '/';
}
