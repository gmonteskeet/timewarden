// Every read and write the screens need. Server only. Each function checks the session first:
// an employee can read and change only their own check ins; a manager can read the people whose
// manager_id is them, approve their days, approve role splits and decide on suggestions.
// Fixtures mode returns fake data; real data mode reads Supabase with the service key and writes
// through the make.com webhooks, except submit and day approval, which the server writes itself
// when their webhook is not set (AGENTS.md section 6 allows this).
//
// Fixtures mode cannot keep anything in server memory (each request may run separately), so demo
// progress lives in one small signed cookie, scout_demo_state, read and written only here. Screens
// never know which mode they are in.
import 'server-only';

import { cookies } from 'next/headers';
import type {
  Candidate,
  CandidateStatus,
  CheckIn,
  CheckInStatus,
  DayAllocation,
  DayDecision,
  Decision,
  DecisionReply,
  InterviewReply,
  InterviewTurn,
  IsoDate,
  MorningRunReply,
  Person,
  Role,
  RolesSyncReply,
  SuggestReply,
  Topic,
  Uuid,
} from './contract';
import { db } from './db';
import * as fx from './fixtures';
import * as make from './make';
import { getSession, signValue, verifyValue, type Session } from './session';

const fixturesMode = () => process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';

/** Thrown when the signed in person may not see or change something. Pages turn it into a refusal. */
export class AccessDenied extends Error {
  readonly signedOut: boolean;
  constructor(message = 'You do not have access to this.', signedOut = false) {
    super(message);
    this.name = 'AccessDenied';
    this.signedOut = signedOut;
  }
}

/** Thrown when a request is understood but not acceptable. The message is shown to the person. */
export class InvalidRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequest';
  }
}


async function signedIn(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AccessDenied('Please sign in first.', true);
  return session;
}

async function asManager(): Promise<Session> {
  const session = await signedIn();
  if (session.app_role !== 'manager') throw new AccessDenied('This is for managers only.');
  return session;
}

// ---------------------------------------------------------------------------
// Shapes the screens use
// ---------------------------------------------------------------------------

export interface RoleWithTopics {
  role: Role;
  topics: Topic[];
  /** Who approved the split, when it is approved. */
  approved_by: Person | null;
}

/** One person's week in the manager's weekly approval view. Only submitted and approved days appear. */
export interface TeamWeek {
  person: Person;
  week_start: IsoDate;
  week_end: IsoDate;
  topics: Topic[];
  /** Allocations of the week's submitted and approved days. */
  allocations: DayAllocation[];
  submitted_ids: Uuid[];
  approved_count: number;
}

/** The approved history behind the suggestions, for the team bars. */
export interface TeamHistory {
  period_start: IsoDate;
  period_end: IsoDate;
  members: { person: Person; topics: Topic[]; allocations: DayAllocation[]; approved_days: number }[];
  /** Rows the employees corrected before submitting, across the period. */
  corrected_rows: number;
}

export interface CheckInView {
  check_in: CheckIn;
  person: Person;
  role: Role;
  topics: Topic[];
  turns: InterviewTurn[];
  allocations: DayAllocation[];
  /** The person's manager, who approves the day. */
  manager: Person | null;
}

export interface CurrentPerson {
  person: Person;
  role: Role;
}

export interface DemoSignIn {
  full_name: string;
  role_title: string;
  app_role: Person['app_role'];
  /** Where the demo sign in link goes. Never carries a real access token. */
  href: string;
}

/** One interview step: Scout's reply, plus a suggested answer for the next question when a script exists. */
export interface InterviewStep {
  reply: InterviewReply;
  suggested_answer: string | null;
}

const SUMMARISED_OR_LATER: CheckInStatus[] = ['summarised', 'submitted', 'approved', 'returned'];
const MAX_ANSWER_LENGTH = 4000;

// ---------------------------------------------------------------------------
// Fixtures mode: demo progress kept in the scout_demo_state cookie
// ---------------------------------------------------------------------------

const DEMO_COOKIE = 'scout_demo_state';
/** How long Scout "takes" to write the summary after the interview ends, in fixtures mode. */
const FIXTURE_SUMMARY_DELAY_MS = 2000;

interface DemoCheckInState {
  /** Scout lines shown so far. */
  n: number;
  /** The employee's answers so far. */
  a: string[];
  /** When the interview finished, in milliseconds. */
  d?: number;
  /** Corrected minutes by allocation id. */
  adj?: Record<string, number>;
  /** When the day was submitted, in milliseconds. */
  sub?: number;
  /** The manager's decision on the submitted day. */
  dec?: { d: DayDecision; at: number; by: Uuid; c: string | null };
}
interface DemoState {
  v: 1;
  c: Record<string, DemoCheckInState>;
  /** Approved role splits: expected percents in topic order, when and by whom. */
  r?: Record<string, { p: number[]; at: number; by: Uuid }>;
  /** When the manager asked Scout to review the history. */
  rv?: number;
  /** Decisions on suggestions. */
  cd?: Record<string, { s: CandidateStatus; url: string | null; at: number; by: Uuid }>;
}

function emptyDemoState(): DemoState {
  return { v: 1, c: {} };
}

async function readDemoState(): Promise<DemoState> {
  const store = await cookies();
  const value = verifyValue(store.get(DEMO_COOKIE)?.value) as DemoState | null;
  if (!value || value.v !== 1 || typeof value.c !== 'object' || value.c === null) return emptyDemoState();
  return value;
}

/** Only works inside a route handler or server function, which is where every write happens. */
async function writeDemoState(state: DemoState): Promise<void> {
  // Keep the cookie well under the 4 KB browser limit by shortening long stored answers if needed.
  let value = signValue(state);
  for (const limit of [1500, 600, 200]) {
    if (value.length <= 3800) break;
    for (const c of Object.values(state.c)) c.a = c.a.map((t) => (t.length > limit ? `${t.slice(0, limit)}...` : t));
    value = signValue(state);
  }
  const store = await cookies();
  store.set(DEMO_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

/** The check in as it stands after the demo progress so far. */
function withDemoProgress(base: CheckIn, state: DemoState, now = Date.now()): CheckIn {
  const st = state.c[base.id];
  if (!st) return base;
  // A decision counts only if it came after the latest submission (a returned day can be sent again).
  const decision = st.dec && st.dec.at >= (st.sub ?? 0) ? st.dec : undefined;
  let status: CheckInStatus = base.status;
  if (decision) status = decision.d;
  else if (st.sub) status = 'submitted';
  else if (st.d && now - st.d >= FIXTURE_SUMMARY_DELAY_MS) status = 'summarised';
  else if (st.n > 0) status = 'in_progress';
  const summarised = SUMMARISED_OR_LATER.includes(status);
  return {
    ...base,
    status,
    approved_by: decision?.d === 'approved' ? decision.by : base.approved_by,
    approved_at: decision?.d === 'approved' ? new Date(decision.at).toISOString() : base.approved_at,
    manager_comment: decision ? decision.c : base.manager_comment,
    summary_text: summarised ? (fx.scriptedSummaryFor(base.id) ?? base.summary_text) : base.summary_text,
    submitted_at: st.sub ? new Date(st.sub).toISOString() : base.submitted_at,
  };
}

function demoTurns(checkInId: Uuid, st: DemoCheckInState | undefined): InterviewTurn[] {
  if (!st) return [];
  const script = fx.scoutScriptFor(checkInId);
  const turns: InterviewTurn[] = [];
  for (let i = 0; i < st.n && i < script.length; i++) {
    const line = script[i];
    turns.push({
      id: `it-${checkInId}-${2 * i + 1}`,
      check_in_id: checkInId,
      turn_no: 2 * i + 1,
      speaker: 'scout',
      text: line.question,
      kind: line.kind,
      evidence: line.evidence,
      created_at: fx.DEMO_DAY,
    });
    if (st.a[i] !== undefined) {
      turns.push({
        id: `it-${checkInId}-${2 * i + 2}`,
        check_in_id: checkInId,
        turn_no: 2 * i + 2,
        speaker: 'employee',
        text: st.a[i],
        kind: null,
        evidence: null,
        created_at: fx.DEMO_DAY,
      });
    }
  }
  return turns;
}

function fxRole(roleId: Uuid): Role {
  const role = fx.roles.find((r) => r.id === roleId);
  if (!role) throw new Error(`Unknown role ${roleId}`);
  return role;
}

function fxTopics(roleId: Uuid): Topic[] {
  return fx.topics.filter((t) => t.role_id === roleId).sort((a, b) => a.sort_order - b.sort_order);
}

function fxCheckIns(state: DemoState): CheckIn[] {
  const now = Date.now();
  return fx.checkIns.map((c) => withDemoProgress(c, state, now));
}

function fxAllocations(checkIn: CheckIn, state: DemoState): DayAllocation[] {
  if (!SUMMARISED_OR_LATER.includes(checkIn.status)) return [];
  const base = fx.dayAllocations.filter((a) => a.check_in_id === checkIn.id);
  const adj = state.c[checkIn.id]?.adj;
  if (!adj) return base;
  const person = fx.people.find((p) => p.id === checkIn.person_id);
  const changed = base.map((a) => (a.id in adj ? { ...a, minutes: adj[a.id], employee_adjusted: a.minutes !== adj[a.id] || a.employee_adjusted } : a));
  return fx.withPercents(changed, person?.working_minutes_per_day ?? 480);
}

function fxView(checkIn: CheckIn, state: DemoState): CheckInView {
  const person = fx.people.find((p) => p.id === checkIn.person_id)!;
  return {
    check_in: checkIn,
    person,
    role: fxRole(person.role_id),
    topics: fxTopics(person.role_id),
    turns: [...fx.interviewTurns.filter((t) => t.check_in_id === checkIn.id), ...demoTurns(checkIn.id, state.c[checkIn.id])],
    allocations: fxAllocations(checkIn, state),
    manager: fx.people.find((p) => p.id === person.manager_id) ?? null,
  };
}

/** Days a manager may see: only once the employee has submitted them (rule 12 in AGENTS.md). */
const VISIBLE_TO_MANAGER: CheckInStatus[] = ['submitted', 'approved', 'returned'];

/** Rights for one check in: the owner, or the owner's manager once the day has been submitted. */
function mayReadCheckIn(session: Session, checkIn: CheckIn): boolean {
  if (checkIn.person_id === session.person_id) return true;
  if (session.app_role !== 'manager') return false;
  const owner = fx.people.find((p) => p.id === checkIn.person_id);
  return owner?.manager_id === session.person_id && VISIBLE_TO_MANAGER.includes(checkIn.status);
}

function fxTeam(managerId: Uuid): Person[] {
  return fx.people.filter((p) => p.manager_id === managerId);
}

// ---------------------------------------------------------------------------
// Sign in (no session needed)
// ---------------------------------------------------------------------------

const demoSignInAllowed = () => fixturesMode() || process.env.DEMO_SIGN_IN === 'true';

/**
 * The labelled demo sign in list on the home page, for judges. In fixtures mode the links carry the
 * readable fake tokens. In real data mode they go to /demo/enter/<person id>, so no real access token
 * is ever put in the page, and the list is empty unless the server setting DEMO_SIGN_IN is "true".
 */
export async function listDemoSignIns(): Promise<DemoSignIn[]> {
  if (fixturesMode()) {
    return fx.people.map((p) => ({ full_name: p.full_name, role_title: fxRole(p.role_id).title, app_role: p.app_role, href: `/enter/${encodeURIComponent(p.access_token)}` }));
  }
  if (!demoSignInAllowed()) return [];
  const people = (await run<Row[]>('read the people', db().from('people').select(PERSON_COLUMNS).order('app_role', { ascending: false }).order('full_name'))).map(toPerson);
  const roles = await Promise.all([...new Set(people.map((p) => p.role_id))].map(liveRole));
  return people.map((p) => ({
    full_name: p.full_name,
    role_title: roles.find((r) => r.id === p.role_id)?.title ?? '',
    app_role: p.app_role,
    href: `/demo/enter/${encodeURIComponent(p.id)}`,
  }));
}

/** Used by /enter/[token] to turn a personal link into a session. */
export async function findPersonByToken(token: string): Promise<Person | null> {
  if (fixturesMode()) return fx.people.find((p) => p.access_token === token) ?? null;
  if (!token || token.length > 200) return null;
  const rows = await run<Row[]>('check a sign in link', db().from('people').select(PERSON_COLUMNS).eq('access_token', token).limit(1));
  return rows[0] ? toPerson(rows[0]) : null;
}

/** Used by /demo/enter/[personId]. Works only in fixtures mode or when DEMO_SIGN_IN is "true". */
export async function findPersonForDemoSignIn(personId: string): Promise<Person | null> {
  if (!demoSignInAllowed()) return null;
  if (fixturesMode()) return fx.people.find((p) => p.id === personId) ?? null;
  return livePerson(personId);
}

/** Where a person lands after signing in when the link has no next path. */
export async function landingPathFor(person: Person): Promise<string> {
  if (fixturesMode()) return fx.fixtureLandingPath(person);
  return person.app_role === 'manager' ? '/manager/roles' : '/check-in/current';
}

/** Whether the home page offers "Reset the demo". */
export async function canResetDemo(): Promise<boolean> {
  return true;
}

/** What "Reset the demo" does in this mode, in words. */
export async function demoResetNote(): Promise<string> {
  return fixturesMode()
    ? 'Clears the interview, corrections and approvals made in this browser.'
    : 'Clears this browser only. Gerson\'s reset script clears the live database.';
}

/** Clears the demo progress cookie in this browser. Call from a route handler. */
export async function resetDemo(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}

/** The honest mode marker shown in the footer of every page. */
export async function dataModeLabel(): Promise<string> {
  return fixturesMode() ? 'Running on sample data' : 'Running on live data through make.com';
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The signed in person and their role, or null when nobody is signed in. */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const session = await getSession();
  if (!session) return null;
  if (!fixturesMode()) {
    const person = await livePerson(session.person_id);
    return person ? { person, role: await liveRole(person.role_id) } : null;
  }
  const person = fx.people.find((p) => p.id === session.person_id);
  if (!person) return null;
  return { person, role: fxRole(person.role_id) };
}

/** One check in with its interview and allocations. Owner or the owner's manager only. */
export async function getCheckIn(checkInId: Uuid): Promise<CheckInView> {
  const session = await signedIn();
  if (!fixturesMode()) {
    const checkIn = await liveCheckInRow(checkInId);
    if (!checkIn || !(await liveMayRead(session, checkIn))) throw new AccessDenied();
    return liveView(checkIn);
  }
  const state = await readDemoState();
  const checkIn = fxCheckIns(state).find((c) => c.id === checkInId);
  if (!checkIn || !mayReadCheckIn(session, checkIn)) throw new AccessDenied();
  return fxView(checkIn, state);
}

/** The status of the signed in employee's own check in, for polling. */
export async function getCheckInStatus(checkInId: Uuid): Promise<CheckInStatus> {
  if (!fixturesMode()) return (await liveOwnCheckIn(await signedIn(), checkInId)).status;
  const { checkIn } = await ownCheckIn(checkInId);
  return checkIn.status;
}

/** The scripted answer to Scout's current question, when a script exists (fixtures mode). */
export async function getSuggestedAnswer(checkInId: Uuid): Promise<string | null> {
  if (!fixturesMode()) {
    const session = await signedIn();
    const checkIn = await liveOwnCheckIn(session, checkInId);
    const person = await livePerson(session.person_id);
    return person ? liveSuggestion(person, checkIn, await liveTurns(checkInId)) : null;
  }
  const { state } = await ownCheckIn(checkInId);
  return suggestionFor(checkInId, state.c[checkInId]);
}

/** The signed in employee's own check ins, newest first. */
export async function listMyCheckIns(): Promise<CheckIn[]> {
  const session = await signedIn();
  if (!fixturesMode()) {
    const rows = await run<Row[]>('read your check ins', db().from('check_ins').select('*').eq('person_id', session.person_id).order('day', { ascending: false }));
    return rows.map(toCheckIn);
  }
  const state = await readDemoState();
  return fxCheckIns(state)
    .filter((c) => c.person_id === session.person_id)
    .sort((a, b) => b.day.localeCompare(a.day));
}

/** The signed in employee's own check in for one day, or null if the morning routine has not made one. */
export async function findMyCheckInForDay(day: IsoDate): Promise<CheckIn | null> {
  const mine = await listMyCheckIns();
  return mine.find((c) => c.day === day) ?? null;
}

/** The demo day: the working day every check in link is about. */
export async function demoDay(): Promise<IsoDate> {
  return process.env.NEXT_PUBLIC_DEMO_DAY || fx.DEMO_DAY;
}

function fxRolesWithTopics(state: DemoState): RoleWithTopics[] {
  return fx.roles.map((base) => {
    const approval = state.r?.[base.id];
    const baseTopics = fxTopics(base.id);
    if (!approval) return { role: base, topics: baseTopics, approved_by: null };
    return {
      role: { ...base, split_status: 'approved', split_approved_by: approval.by, split_approved_at: new Date(approval.at).toISOString() },
      topics: baseTopics.map((t, i) => ({ ...t, expected_percent: approval.p[i] ?? t.expected_percent })),
      approved_by: fx.people.find((p) => p.id === approval.by) ?? null,
    };
  });
}

/** Every role in the manager's company with its topics and who approved the split. */
export async function listRolesWithTopics(): Promise<RoleWithTopics[]> {
  const session = await asManager();
  if (!fixturesMode()) return liveRolesWithTopics(session);
  return fxRolesWithTopics(await readDemoState());
}

/** The manager's team. */
export async function listTeam(): Promise<Person[]> {
  const session = await asManager();
  if (!fixturesMode()) return liveTeam(session.person_id);
  return fxTeam(session.person_id);
}

/** Days the manager's team has submitted and that wait for approval. */
export async function listDaysAwaitingApproval(): Promise<CheckInView[]> {
  const session = await asManager();
  if (!fixturesMode()) {
    const { checkIns } = await liveTeamCheckIns(session.person_id, ['submitted']);
    return Promise.all(checkIns.map(liveView));
  }
  const state = await readDemoState();
  const team = new Set(fxTeam(session.person_id).map((p) => p.id));
  return fxCheckIns(state)
    .filter((c) => team.has(c.person_id) && c.status === 'submitted')
    .map((c) => fxView(c, state));
}

function mondayOf(day: IsoDate): IsoDate {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(day: IsoDate, n: number): IsoDate {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The weekly approval view: for each person with a submitted day, the week (Monday to Friday) that
 * contains it, built only from submitted and approved days. Days not yet submitted never appear.
 */
export async function listTeamWeeks(): Promise<TeamWeek[]> {
  const session = await asManager();
  let all: CheckIn[];
  let team: Person[];
  let allocationsFor: (c: CheckIn) => DayAllocation[];
  let topicsFor: (p: Person) => Topic[];
  if (!fixturesMode()) {
    const live = await liveTeamCheckIns(session.person_id, ['submitted', 'approved']);
    all = live.checkIns;
    team = live.team;
    const submittedWeeks = new Set(all.filter((c) => c.status === 'submitted').map((c) => mondayOf(c.day)));
    const inWeeks = all.filter((c) => submittedWeeks.has(mondayOf(c.day)));
    const allocations = await liveAllocations(inWeeks.map((c) => c.id));
    const topics = await liveTopics(team.map((p) => p.role_id));
    allocationsFor = (c) => allocations.filter((a) => a.check_in_id === c.id);
    topicsFor = (p) => topics.filter((t) => t.role_id === p.role_id);
  } else {
    const state = await readDemoState();
    all = fxCheckIns(state);
    team = fxTeam(session.person_id);
    allocationsFor = (c) => fxAllocations(c, state);
    topicsFor = (p) => fxTopics(p.role_id);
  }
  const weeks: TeamWeek[] = [];
  for (const person of team) {
    const starts = [...new Set(all.filter((c) => c.person_id === person.id && c.status === 'submitted').map((c) => mondayOf(c.day)))].sort();
    for (const week_start of starts) {
      const week_end = addDays(week_start, 4);
      const days = all.filter((c) => c.person_id === person.id && c.day >= week_start && c.day <= week_end && (c.status === 'submitted' || c.status === 'approved'));
      weeks.push({
        person,
        week_start,
        week_end,
        topics: topicsFor(person),
        allocations: days.flatMap(allocationsFor),
        submitted_ids: days.filter((c) => c.status === 'submitted').map((c) => c.id),
        approved_count: days.filter((c) => c.status === 'approved').length,
      });
    }
  }
  return weeks;
}

/** The team's approved days in a period, for the team bars and the "employees came first" line. */
export async function getTeamHistory(periodStart: IsoDate, periodEnd: IsoDate): Promise<TeamHistory> {
  const session = await asManager();
  if (!fixturesMode()) {
    const { team, checkIns } = await liveTeamCheckIns(session.person_id, ['approved'], periodStart, periodEnd);
    const [allocations, topics] = await Promise.all([liveAllocations(checkIns.map((c) => c.id)), liveTopics(team.map((p) => p.role_id))]);
    const members = team.map((person) => {
      const days = checkIns.filter((c) => c.person_id === person.id);
      const ids = new Set(days.map((c) => c.id));
      return { person, topics: topics.filter((t) => t.role_id === person.role_id), allocations: allocations.filter((a) => ids.has(a.check_in_id)), approved_days: days.length };
    });
    return { period_start: periodStart, period_end: periodEnd, members, corrected_rows: allocations.filter((a) => a.employee_adjusted).length };
  }
  const state = await readDemoState();
  const approved = fxCheckIns(state).filter((c) => c.status === 'approved' && c.day >= periodStart && c.day <= periodEnd);
  const members = fxTeam(session.person_id).map((person) => {
    const days = approved.filter((c) => c.person_id === person.id);
    return { person, topics: fxTopics(person.role_id), allocations: days.flatMap((c) => fxAllocations(c, state)), approved_days: days.length };
  });
  return {
    period_start: periodStart,
    period_end: periodEnd,
    members,
    corrected_rows: members.reduce((s, m) => s + m.allocations.filter((a) => a.employee_adjusted).length, 0),
  };
}

/** Approved allocations for the manager's team in a period, for the team bars on Suggestions. */
export async function getTeamAllocations(periodStart: IsoDate, periodEnd: IsoDate): Promise<DayAllocation[]> {
  const session = await asManager();
  if (!fixturesMode()) {
    const { checkIns } = await liveTeamCheckIns(session.person_id, ['approved'], periodStart, periodEnd);
    return liveAllocations(checkIns.map((c) => c.id));
  }
  const state = await readDemoState();
  const team = new Set(fxTeam(session.person_id).map((p) => p.id));
  const approved = fxCheckIns(state).filter((c) => team.has(c.person_id) && c.status === 'approved' && c.day >= periodStart && c.day <= periodEnd);
  return approved.flatMap((c) => fxAllocations(c, state));
}

function fxCandidates(state: DemoState): Candidate[] {
  if (!state.rv) return [];
  return fx.candidates
    .map((c) => {
      const d = state.cd?.[c.id];
      return d ? { ...c, status: d.s, make_scenario_url: d.url, make_scenario_id: d.url ? `draft-${c.id}` : null } : c;
    })
    .sort((a, b) => a.rank - b.rank);
}

/** The period Suggestions reviews: from the Monday two weeks before the demo day's week to the demo day. */
export async function reviewPeriod(): Promise<{ period_start: IsoDate; period_end: IsoDate }> {
  const end = process.env.NEXT_PUBLIC_DEMO_DAY || fx.DEMO_DAY;
  return { period_start: addDays(mondayOf(end), -14), period_end: end };
}

/** Suggested workflows for the company, ranked. Empty until Scout has reviewed the history. */
export async function listCandidates(): Promise<Candidate[]> {
  const session = await asManager();
  if (!fixturesMode()) return liveCandidates(session);
  return fxCandidates(await readDemoState());
}

/** One suggestion, for polling until its draft link appears. */
export async function getCandidate(candidateId: Uuid): Promise<Candidate> {
  const session = await asManager();
  const candidate = fixturesMode()
    ? fxCandidates(await readDemoState()).find((c) => c.id === candidateId)
    : (await liveCandidates(session)).find((c) => c.id === candidateId);
  if (!candidate) throw new AccessDenied();
  return candidate;
}

// ---------------------------------------------------------------------------
// Writes. Each checks rights, then calls the matching make.com webhook.
// ---------------------------------------------------------------------------

/** Fixtures mode only: the signed in employee's own check in with the demo progress applied. */
async function ownCheckIn(checkInId: Uuid): Promise<{ session: Session; checkIn: CheckIn; state: DemoState }> {
  const session = await signedIn();
  const state = await readDemoState();
  const checkIn = fxCheckIns(state).find((c) => c.id === checkInId);
  if (!checkIn || checkIn.person_id !== session.person_id) throw new AccessDenied();
  return { session, checkIn, state };
}

function suggestionFor(checkInId: Uuid, st: DemoCheckInState | undefined): string | null {
  const answers = fx.scriptedAnswersFor(checkInId);
  const index = st ? st.a.length : 0;
  if (!st || st.d || st.n <= index) return null;
  return answers[index] ?? null;
}

function replyForLine(checkInId: Uuid, index: number): InterviewReply {
  const script = fx.scoutScriptFor(checkInId);
  const line = script[Math.min(index, script.length - 1)];
  return { ok: true, done: line.kind === 'closing', turn_no: 2 * index + 1, question: line.question, kind: line.kind, evidence: line.evidence };
}

/**
 * Sends one answer (or null to start) and returns Scout's next line. Safe to repeat: starting again
 * returns the current question, and resending the last answer returns the reply it already got.
 */
export async function sendInterviewAnswer(checkInId: Uuid, employeeText: string | null): Promise<InterviewStep> {
  const text = employeeText === null ? null : employeeText.trim();
  if (text !== null && text.length === 0) throw new InvalidRequest('Please write or say an answer first.');
  if (text !== null && text.length > MAX_ANSWER_LENGTH) throw new InvalidRequest(`Please keep each answer under ${MAX_ANSWER_LENGTH} characters.`);
  if (!fixturesMode()) return liveSendAnswer(await signedIn(), checkInId, text);
  const { checkIn, state } = await ownCheckIn(checkInId);
  if (!['invited', 'in_progress', 'returned'].includes(checkIn.status) && !state.c[checkInId]?.d) {
    throw new InvalidRequest('This day has already been summarised.');
  }

  const st: DemoCheckInState = state.c[checkInId] ?? { n: 0, a: [] };

  // Already finished, or a repeat of the start, or a resend of the last answer: nothing new happens.
  if (st.d) return { reply: replyForLine(checkInId, st.n - 1), suggested_answer: null };
  if (text === null && st.n > 0) return { reply: replyForLine(checkInId, st.n - 1), suggested_answer: suggestionFor(checkInId, st) };
  // After an answer is recorded, Scout's next line is already shown, so answers are one behind lines.
  if (text !== null && st.a.length > 0 && st.a.length === st.n - 1 && st.a[st.a.length - 1] === text) {
    return { reply: replyForLine(checkInId, st.n - 1), suggested_answer: suggestionFor(checkInId, st) };
  }
  if (text !== null && st.n === 0) throw new InvalidRequest('The interview has not started yet.');

  const turnsSoFar = st.n + st.a.length;
  const reply = await make.interviewTurn({ check_in_id: checkInId, employee_text: text }, { turnsSoFar });
  if (text !== null) st.a.push(text);
  st.n += 1;
  if (reply.done) st.d = Date.now();
  state.c[checkInId] = st;
  await writeDemoState(state);
  return { reply, suggested_answer: suggestionFor(checkInId, st) };
}

/**
 * The employee submits their day. Adjustments must belong to this check in, be whole minutes of
 * zero or more, and leave the day adding up to the working minutes exactly.
 */
export async function submitCheckIn(checkInId: Uuid, adjustments: { allocation_id: Uuid; minutes: number }[]): Promise<void> {
  if (!fixturesMode()) return liveSubmit(await signedIn(), checkInId, adjustments);
  const { checkIn, state, session } = await ownCheckIn(checkInId);
  if (checkIn.status !== 'summarised' && checkIn.status !== 'returned') {
    throw new InvalidRequest(checkIn.status === 'submitted' || checkIn.status === 'approved' ? 'This day has already been sent.' : 'The summary for this day is not ready yet.');
  }
  const allocations = fxAllocations(checkIn, state);
  const ids = new Set(allocations.map((a) => a.id));
  for (const adj of adjustments) {
    if (!ids.has(adj.allocation_id)) throw new InvalidRequest('One of the corrections does not belong to this day.');
    if (!Number.isInteger(adj.minutes) || adj.minutes < 0) throw new InvalidRequest('Corrections must be whole minutes of zero or more.');
  }
  const person = fx.people.find((p) => p.id === session.person_id)!;
  const byId = new Map(adjustments.map((a) => [a.allocation_id, a.minutes]));
  const total = allocations.reduce((s, a) => s + (byId.get(a.id) ?? a.minutes), 0);
  if (total !== person.working_minutes_per_day) {
    throw new InvalidRequest(`The day adds up to ${total} minutes, but it needs to add up to ${person.working_minutes_per_day} minutes.`);
  }

  await make.submitDay({ check_in_id: checkInId, adjustments });
  const st: DemoCheckInState = state.c[checkInId] ?? { n: 0, a: [] };
  st.adj = { ...(st.adj ?? {}), ...Object.fromEntries(byId) };
  st.sub = Date.now();
  state.c[checkInId] = st;
  await writeDemoState(state);
}

/** The manager approves or returns submitted days of their own team. */
export async function decideOnDays(checkInIds: Uuid[], decision: DayDecision, comment: string | null): Promise<void> {
  const session = await asManager();
  const text = comment?.trim() || null;
  if (decision !== 'approved' && decision !== 'returned') throw new InvalidRequest('Please choose approve or return.');
  if (decision === 'returned' && !text) throw new InvalidRequest('Please say what needs changing before you return the day.');
  if (checkInIds.length === 0) throw new InvalidRequest('Please choose at least one day.');
  if (!fixturesMode()) return liveDecideDays(session, checkInIds, decision, text);
  const state = await readDemoState();
  const all = fxCheckIns(state);
  for (const id of checkInIds) {
    const checkIn = all.find((c) => c.id === id);
    // A day that is not waiting for approval is refused like any other day the manager cannot act on,
    // so the reply never reveals anything about days the employee has not submitted.
    if (!checkIn || !mayReadCheckIn(session, checkIn) || checkIn.person_id === session.person_id || checkIn.status !== 'submitted') {
      throw new AccessDenied();
    }
  }
  await make.decideDays({ check_in_ids: checkInIds, approver_id: session.person_id, decision, comment: text });
  const at = Date.now();
  for (const id of checkInIds) {
    const st: DemoCheckInState = state.c[id] ?? { n: 0, a: [] };
    st.dec = { d: decision, at, by: session.person_id, c: text };
    state.c[id] = st;
  }
  await writeDemoState(state);
}

/** Checks a split against the role's topics: every topic once, whole numbers, total exactly 100. */
function validateSplit(roleTopics: Topic[], topics: { topic_id: Uuid; expected_percent: number }[]): Map<Uuid, number> {
  const byId = new Map(topics.map((t) => [t.topic_id, t.expected_percent]));
  if (topics.length !== roleTopics.length || roleTopics.some((t) => !byId.has(t.id))) {
    throw new InvalidRequest('Every topic of the role needs a number.');
  }
  if (topics.some((t) => !Number.isInteger(t.expected_percent) || t.expected_percent < 0 || t.expected_percent > 100)) {
    throw new InvalidRequest('Each share must be a whole number from 0 to 100.');
  }
  const total = topics.reduce((s, t) => s + t.expected_percent, 0);
  if (total !== 100) throw new InvalidRequest(`The split adds up to ${total} percent. It needs to add up to 100.`);
  return byId;
}

/** The manager approves a role's split. The percents must add up to 100. */
export async function approveRoleSplit(roleId: Uuid, topics: { topic_id: Uuid; expected_percent: number }[]): Promise<void> {
  const session = await asManager();
  if (!fixturesMode()) return liveApproveSplit(session, roleId, topics);
  if (!fx.roles.some((r) => r.id === roleId)) throw new AccessDenied();
  const roleTopics = fxTopics(roleId);
  const byId = validateSplit(roleTopics, topics);
  await make.approveSplit({ role_id: roleId, approver_id: session.person_id, topics });
  const state = await readDemoState();
  state.r = { ...(state.r ?? {}), [roleId]: { p: roleTopics.map((t) => byId.get(t.id)!), at: Date.now(), by: session.person_id } };
  await writeDemoState(state);
}

/**
 * Whether reading the role documents again is switched on. Scenario one needs a person to connect
 * the document store in make.com, so it may not exist. When it does not, the Roles page says
 * plainly that Scout read the documents when the company was set up, and offers no button.
 */
export function canRereadRoleDocuments(): boolean {
  return fixturesMode() || !!process.env.MAKE_WEBHOOK_ROLES_SYNC;
}

/** Asks Scout to read the role documents again and propose splits. */
export async function rereadRoleDocuments(): Promise<RolesSyncReply> {
  const session = await asManager();
  const companyId = fixturesMode() ? fx.company.id : await liveManagerCompany(session);
  return make.syncRoles({ company_id: companyId });
}

/** When Scout last read a role document, and how many roles and topics there are. For polling. */
export async function getRolesReadStatus(): Promise<{ last_read_at: string | null; roles: number; topics: number }> {
  const roles = await listRolesWithTopics();
  const times = roles.map((r) => r.role.source_read_at).filter(Boolean).sort();
  return { last_read_at: times[times.length - 1] ?? null, roles: roles.length, topics: roles.reduce((s, r) => s + r.topics.length, 0) };
}

/** Runs the morning routine now for a day. */
export async function runMorningRoutine(day: IsoDate): Promise<MorningRunReply> {
  const session = await asManager();
  const companyId = fixturesMode() ? fx.company.id : await liveManagerCompany(session);
  return make.runMorning({ company_id: companyId, day });
}

/** Asks Scout to review approved history in a period and suggest workflows. */
export async function reviewHistory(periodStart: IsoDate, periodEnd: IsoDate): Promise<SuggestReply> {
  const session = await asManager();
  if (!fixturesMode()) return make.suggestWorkflows({ company_id: await liveManagerCompany(session), period_start: periodStart, period_end: periodEnd });
  const reply = await make.suggestWorkflows({ company_id: fx.company.id, period_start: periodStart, period_end: periodEnd });
  const state = await readDemoState();
  state.rv = Date.now();
  await writeDemoState(state);
  return reply;
}

/**
 * Suggestions with a flag saying whether any were written since a moment in time. Used to tell when
 * a review that make.com answered early has finished. In fixtures mode the review is always complete.
 */
export async function listCandidatesSince(since: string): Promise<{ candidates: Candidate[]; complete: boolean }> {
  const candidates = await listCandidates();
  if (fixturesMode()) return { candidates, complete: candidates.length > 0 };
  const from = Date.parse(since) - 5_000;
  return { candidates, complete: candidates.some((c) => Date.parse(c.created_at) >= from) };
}

/** The manager approves or rejects a suggestion. Approval returns the draft scenario link. */
export async function decideOnCandidate(candidateId: Uuid, decision: Decision, comment: string | null): Promise<DecisionReply> {
  const session = await asManager();
  if (decision !== 'approved' && decision !== 'rejected') throw new InvalidRequest('Please choose approve or not now.');
  if (!fixturesMode()) {
    const candidate = (await liveCandidates(session)).find((c) => c.id === candidateId);
    if (!candidate) throw new AccessDenied();
    if (candidate.make_scenario_url) return { ok: true, make_scenario_url: candidate.make_scenario_url };
    return make.decideCandidate({ candidate_id: candidateId, approver_id: session.person_id, decision, comment });
  }
  const state = await readDemoState();
  const candidate = fxCandidates(state).find((c) => c.id === candidateId);
  if (!candidate) throw new AccessDenied();
  if (candidate.status === 'drafted') return { ok: true, make_scenario_url: candidate.make_scenario_url ?? undefined };
  const reply = await make.decideCandidate({ candidate_id: candidateId, approver_id: session.person_id, decision, comment });
  const status: CandidateStatus = decision === 'rejected' ? 'rejected' : reply.make_scenario_url ? 'drafted' : 'approved';
  state.cd = { ...(state.cd ?? {}), [candidateId]: { s: status, url: reply.make_scenario_url ?? null, at: Date.now(), by: session.person_id } };
  await writeDemoState(state);
  return reply;
}

// ===========================================================================
// Real data mode: Supabase through the service key, make.com through webhooks.
// The rights checks mirror the fixtures ones above exactly.
// ===========================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);

/** The people columns the screens need. The access token is never read here. */
const PERSON_COLUMNS = 'id, company_id, role_id, full_name, email, app_role, team, manager_id, hourly_cost_eur, calendar_id, working_minutes_per_day, created_at';

/** Runs one query. On failure, logs the detail on the server (never a key) and throws a plain error. */
async function run<T>(what: string, query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) {
    console.error(`[data] Could not ${what}: ${error.code ?? ''} ${error.message}`);
    throw new Error(`Could not ${what}.`);
  }
  return data as T;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
/** A number from the database, or 0 when the column is empty or not a number. Never NaN. */
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const strOrNull = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toPerson(r: Row): Person {
  return {
    id: str(r.id),
    company_id: str(r.company_id),
    role_id: str(r.role_id),
    full_name: str(r.full_name),
    email: str(r.email),
    app_role: r.app_role === 'manager' ? 'manager' : 'employee',
    team: str(r.team),
    manager_id: strOrNull(r.manager_id),
    hourly_cost_eur: num(r.hourly_cost_eur),
    calendar_id: strOrNull(r.calendar_id),
    access_token: '',
    working_minutes_per_day: r.working_minutes_per_day === null || r.working_minutes_per_day === undefined ? 480 : num(r.working_minutes_per_day),
    created_at: str(r.created_at),
  };
}

function toRole(r: Row): Role {
  return {
    id: str(r.id),
    company_id: str(r.company_id),
    title: str(r.title),
    document_name: str(r.document_name),
    document_url: strOrNull(r.document_url),
    job_description: str(r.job_description),
    kpis: Array.isArray(r.kpis) ? (r.kpis as unknown[]).map(str) : [],
    split_status: r.split_status === 'approved' ? 'approved' : 'proposed',
    split_approved_by: strOrNull(r.split_approved_by),
    split_approved_at: strOrNull(r.split_approved_at),
    source_read_at: str(r.source_read_at),
    created_at: str(r.created_at),
  };
}

function toTopic(r: Row): Topic {
  return {
    id: str(r.id),
    role_id: str(r.role_id),
    name: str(r.name),
    description: str(r.description),
    expected_percent: num(r.expected_percent),
    proposed_percent: num(r.proposed_percent),
    reasoning: str(r.reasoning),
    sort_order: num(r.sort_order),
    created_at: str(r.created_at),
  };
}

function toCheckIn(r: Row): CheckIn {
  return {
    id: str(r.id),
    person_id: str(r.person_id),
    day: str(r.day),
    status: str(r.status) as CheckInStatus,
    invited_at: str(r.invited_at),
    submitted_at: strOrNull(r.submitted_at),
    approved_by: strOrNull(r.approved_by),
    approved_at: strOrNull(r.approved_at),
    manager_comment: strOrNull(r.manager_comment),
    summary_text: strOrNull(r.summary_text),
    created_at: str(r.created_at),
  };
}

function toTurn(r: Row): InterviewTurn {
  return {
    id: str(r.id),
    check_in_id: str(r.check_in_id),
    turn_no: num(r.turn_no),
    speaker: r.speaker === 'scout' ? 'scout' : 'employee',
    text: str(r.text),
    kind: (strOrNull(r.kind) as InterviewTurn['kind']) ?? null,
    evidence: strOrNull(r.evidence),
    created_at: str(r.created_at),
  };
}

function toAllocation(r: Row): DayAllocation {
  return {
    id: str(r.id),
    check_in_id: str(r.check_in_id),
    person_id: str(r.person_id),
    day: str(r.day),
    topic_id: strOrNull(r.topic_id),
    label: str(r.label),
    in_role: r.in_role !== false,
    minutes: num(r.minutes),
    percent: num(r.percent),
    evidence: str(r.evidence),
    employee_adjusted: r.employee_adjusted === true,
    created_at: str(r.created_at),
  };
}

function toCandidate(r: Row): Candidate {
  return {
    id: str(r.id),
    company_id: str(r.company_id),
    title: str(r.title),
    description: str(r.description),
    source_label: str(r.source_label),
    people_affected: num(r.people_affected),
    hours_per_week: num(r.hours_per_week),
    annual_cost_eur: num(r.annual_cost_eur),
    period_start: str(r.period_start),
    period_end: str(r.period_end),
    score_time: num(r.score_time),
    score_repetitive: num(r.score_repetitive),
    score_reliability: num(r.score_reliability),
    score_role_distance: num(r.score_role_distance),
    total_score: num(r.total_score),
    rank: num(r.rank),
    reasoning: str(r.reasoning),
    proposed_steps: Array.isArray(r.proposed_steps)
      ? (r.proposed_steps as Row[])
          .filter((step) => step && typeof step === 'object')
          .map((step) => ({ app: str(step.app), action: str(step.action), note: str(step.note) }))
      : [],
    status: (str(r.status) || 'proposed') as CandidateStatus,
    make_scenario_id: strOrNull(r.make_scenario_id),
    make_scenario_url: strOrNull(r.make_scenario_url),
    created_at: str(r.created_at),
  };
}

async function livePerson(personId: Uuid): Promise<Person | null> {
  if (!isUuid(personId)) return null;
  const rows = await run<Row[]>('read a person', db().from('people').select(PERSON_COLUMNS).eq('id', personId).limit(1));
  return rows[0] ? toPerson(rows[0]) : null;
}

async function liveRole(roleId: Uuid): Promise<Role> {
  const rows = isUuid(roleId) ? await run<Row[]>('read a role', db().from('roles').select('*').eq('id', roleId).limit(1)) : [];
  return rows[0]
    ? toRole(rows[0])
    : { id: roleId, company_id: '', title: 'No role yet', document_name: '', document_url: null, job_description: '', kpis: [], split_status: 'proposed', split_approved_by: null, split_approved_at: null, source_read_at: '', created_at: '' };
}

async function liveTopics(roleIds: Uuid[]): Promise<Topic[]> {
  const ids = roleIds.filter(isUuid);
  if (ids.length === 0) return [];
  const rows = await run<Row[]>('read the topics', db().from('topics').select('*').in('role_id', ids).order('sort_order').order('name'));
  return rows.map(toTopic);
}

async function liveCheckInRow(checkInId: Uuid): Promise<CheckIn | null> {
  if (!isUuid(checkInId)) return null;
  const rows = await run<Row[]>('read a check in', db().from('check_ins').select('*').eq('id', checkInId).limit(1));
  return rows[0] ? toCheckIn(rows[0]) : null;
}

async function liveTurns(checkInId: Uuid): Promise<InterviewTurn[]> {
  const rows = await run<Row[]>('read the interview', db().from('interview_turns').select('*').eq('check_in_id', checkInId).order('turn_no'));
  return rows.map(toTurn);
}

async function liveAllocations(checkInIds: Uuid[]): Promise<DayAllocation[]> {
  if (checkInIds.length === 0) return [];
  const rows = await run<Row[]>('read the day allocations', db().from('day_allocations').select('*').in('check_in_id', checkInIds).order('created_at').limit(5000));
  return rows.map(toAllocation);
}

async function liveTeam(managerId: Uuid): Promise<Person[]> {
  const rows = await run<Row[]>('read the team', db().from('people').select(PERSON_COLUMNS).eq('manager_id', managerId).order('full_name'));
  return rows.map(toPerson);
}

async function liveMayRead(session: Session, checkIn: CheckIn): Promise<boolean> {
  if (checkIn.person_id === session.person_id) return true;
  if (session.app_role !== 'manager' || !VISIBLE_TO_MANAGER.includes(checkIn.status)) return false;
  const owner = await livePerson(checkIn.person_id);
  return owner?.manager_id === session.person_id;
}

async function liveView(checkIn: CheckIn): Promise<CheckInView> {
  const person = await livePerson(checkIn.person_id);
  if (!person) throw new AccessDenied();
  const [role, topics, turns, allocations, manager] = await Promise.all([
    liveRole(person.role_id),
    liveTopics([person.role_id]),
    liveTurns(checkIn.id),
    SUMMARISED_OR_LATER.includes(checkIn.status) ? liveAllocations([checkIn.id]) : Promise.resolve([]),
    person.manager_id ? livePerson(person.manager_id) : Promise.resolve(null),
  ]);
  return { check_in: checkIn, person, role, topics, turns, allocations, manager };
}

async function liveOwnCheckIn(session: Session, checkInId: Uuid): Promise<CheckIn> {
  const checkIn = await liveCheckInRow(checkInId);
  if (!checkIn || checkIn.person_id !== session.person_id) throw new AccessDenied();
  return checkIn;
}

async function liveManagerCompany(session: Session): Promise<Uuid> {
  const me = await livePerson(session.person_id);
  if (!me) throw new AccessDenied();
  return me.company_id;
}

async function liveTeamCheckIns(managerId: Uuid, statuses: CheckInStatus[], from?: IsoDate, to?: IsoDate): Promise<{ team: Person[]; checkIns: CheckIn[] }> {
  const team = await liveTeam(managerId);
  if (team.length === 0) return { team, checkIns: [] };
  let query = db().from('check_ins').select('*').in('person_id', team.map((p) => p.id)).in('status', statuses);
  if (from) query = query.gte('day', from);
  if (to) query = query.lte('day', to);
  const rows = await run<Row[]>('read the team check ins', query.order('day').limit(2000));
  return { team, checkIns: rows.map(toCheckIn) };
}

/** Elena's scripted answer for her demo day, so the live demo is repeatable. Null otherwise. */
function liveSuggestion(person: Person, checkIn: CheckIn, turns: InterviewTurn[]): string | null {
  if (person.full_name !== 'Elena Ruiz' || checkIn.day !== (process.env.NEXT_PUBLIC_DEMO_DAY || fx.DEMO_DAY)) return null;
  const last = turns[turns.length - 1];
  if (!last || last.speaker !== 'scout' || last.kind === 'closing') return null;
  const answers = fx.scriptedAnswersFor(fx.ELENA_FRIDAY_ID);
  return answers[turns.filter((t) => t.speaker === 'employee').length] ?? null;
}

function replyFromTurn(turn: InterviewTurn): InterviewReply {
  return { ok: true, done: turn.kind === 'closing', turn_no: turn.turn_no, question: turn.text, kind: turn.kind ?? 'elaboration', evidence: turn.evidence ?? '' };
}

const WAITING_FOR_SCOUT = 'Scout has not answered your last message yet. Your answer is saved. Please try again in a moment.';

/**
 * One interview turn on real data. make.com records the answer and writes Scout's reply; nothing
 * here writes interview turns. Resending an answer is never done, because the database function
 * records every answer it is given: "Try again" only reads what is already there.
 */
async function liveSendAnswer(session: Session, checkInId: Uuid, text: string | null): Promise<InterviewStep> {
  const checkIn = await liveOwnCheckIn(session, checkInId);
  const person = (await livePerson(session.person_id))!;
  const turns = await liveTurns(checkInId);
  const last = turns[turns.length - 1];
  const previous = turns[turns.length - 2];

  if (last?.kind === 'closing') return { reply: replyFromTurn(last), suggested_answer: null };
  if (!['invited', 'in_progress', 'returned'].includes(checkIn.status)) throw new InvalidRequest('This day has already been summarised.');

  if (text === null) {
    if (!last) {
      const reply = await make.interviewTurn({ check_in_id: checkInId, employee_text: null });
      return { reply, suggested_answer: liveSuggestion(person, checkIn, await liveTurns(checkInId)) };
    }
    if (last.speaker === 'scout') return { reply: replyFromTurn(last), suggested_answer: liveSuggestion(person, checkIn, turns) };
    throw new InvalidRequest(WAITING_FOR_SCOUT);
  }

  if (!last) throw new InvalidRequest('The interview has not started yet. Please reload the page.');
  // The same answer again after Scout has already replied to it: a retry that worked. Show the reply.
  if (last.speaker === 'scout' && previous?.speaker === 'employee' && previous.text === text) {
    return { reply: replyFromTurn(last), suggested_answer: liveSuggestion(person, checkIn, turns) };
  }
  // The last answer is still waiting for Scout. Never send it, or anything else, a second time.
  if (last.speaker === 'employee') throw new InvalidRequest(WAITING_FOR_SCOUT);

  const reply = await make.interviewTurn({ check_in_id: checkInId, employee_text: text });
  return { reply, suggested_answer: liveSuggestion(person, checkIn, await liveTurns(checkInId)) };
}

async function liveSubmit(session: Session, checkInId: Uuid, adjustments: { allocation_id: Uuid; minutes: number }[]): Promise<void> {
  const checkIn = await liveOwnCheckIn(session, checkInId);
  if (checkIn.status !== 'summarised' && checkIn.status !== 'returned') {
    throw new InvalidRequest(checkIn.status === 'submitted' || checkIn.status === 'approved' ? 'This day has already been sent.' : 'The summary for this day is not ready yet.');
  }
  const person = (await livePerson(session.person_id))!;
  const allocations = await liveAllocations([checkInId]);
  const ids = new Set(allocations.map((a) => a.id));
  for (const adj of adjustments) {
    if (!ids.has(adj.allocation_id)) throw new InvalidRequest('One of the corrections does not belong to this day.');
    if (!Number.isInteger(adj.minutes) || adj.minutes < 0) throw new InvalidRequest('Corrections must be whole minutes of zero or more.');
  }
  const byId = new Map(adjustments.map((a) => [a.allocation_id, a.minutes]));
  const total = allocations.reduce((s, a) => s + (byId.get(a.id) ?? a.minutes), 0);
  if (total !== person.working_minutes_per_day) {
    throw new InvalidRequest(`The day adds up to ${total} minutes, but it needs to add up to ${person.working_minutes_per_day} minutes.`);
  }
  // Through make.com when scenario six exists. Without it, AGENTS.md section 6 lets the server write
  // the day straight to the database.
  if (make.hasWebhook('MAKE_WEBHOOK_SUBMIT')) {
    await make.submitDay({ check_in_id: checkInId, adjustments });
    return;
  }
  await liveWriteSubmit(checkInId, allocations, byId, person.working_minutes_per_day);
}

/**
 * Percent of the working day for each row, to two decimal places, with the largest row taking the
 * rounding so the day adds up to exactly 100 (the rule in docs/decisions.md decision 12).
 */
function dayPercents(rows: { id: Uuid; minutes: number }[], workingMinutes: number): Map<Uuid, number> {
  const out = new Map(rows.map((r) => [r.id, Math.round((r.minutes / workingMinutes) * 10000) / 100]));
  if (rows.length === 0) return out;
  const largest = rows.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const others = rows.filter((r) => r.id !== largest.id).reduce((s, r) => s + out.get(r.id)!, 0);
  out.set(largest.id, Math.round((100 - others) * 100) / 100);
  return out;
}

/**
 * Submit written straight to the database. The corrected rows first, then the status. The rows are
 * written with the same values whoever clicks, so a double click is harmless, and the status only
 * moves when it is still summarised or returned, so the day is sent once.
 */
async function liveWriteSubmit(checkInId: Uuid, allocations: DayAllocation[], byId: Map<Uuid, number>, workingMinutes: number): Promise<void> {
  const rows = allocations.map((a) => ({ ...a, newMinutes: byId.get(a.id) ?? a.minutes }));
  const percents = dayPercents(rows.map((r) => ({ id: r.id, minutes: r.newMinutes })), workingMinutes);
  for (const r of rows) {
    const changed = r.newMinutes !== r.minutes;
    const percent = percents.get(r.id)!;
    if (!changed && percent === r.percent) continue;
    const patch: Row = { percent };
    if (changed) {
      patch.minutes = r.newMinutes;
      patch.employee_adjusted = true;
    }
    await run('save a corrected row', db().from('day_allocations').update(patch).eq('id', r.id).eq('check_in_id', checkInId));
  }
  const updated = await run<Row[]>(
    'send the day',
    db()
      .from('check_ins')
      // A comment from an earlier return belongs to the old version of the day, as in fixtures mode.
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), manager_comment: null })
      .eq('id', checkInId)
      .in('status', ['summarised', 'returned'])
      .select('id'),
  );
  if (updated.length === 0) throw new InvalidRequest('This day has already been sent.');
}

async function liveDecideDays(session: Session, checkInIds: Uuid[], decision: DayDecision, comment: string | null): Promise<void> {
  const team = new Set((await liveTeam(session.person_id)).map((p) => p.id));
  for (const id of checkInIds) {
    const checkIn = await liveCheckInRow(id);
    if (!checkIn || !team.has(checkIn.person_id) || checkIn.person_id === session.person_id || checkIn.status !== 'submitted') throw new AccessDenied();
  }
  // Through make.com when scenario six exists. Without it, AGENTS.md section 6 lets the server write
  // the decision straight to the database.
  if (make.hasWebhook('MAKE_WEBHOOK_DAY_APPROVAL')) {
    await make.decideDays({ check_in_ids: checkInIds, approver_id: session.person_id, decision, comment });
    return;
  }
  await liveWriteDayDecision(session, checkInIds, decision, comment);
}

/**
 * Day approval written straight to the database. Only days still waiting for approval change, so a
 * double click cannot approve a day twice or undo a decision made a moment earlier.
 */
async function liveWriteDayDecision(session: Session, checkInIds: Uuid[], decision: DayDecision, comment: string | null): Promise<void> {
  const patch: Row =
    decision === 'approved'
      ? { status: 'approved', approved_by: session.person_id, approved_at: new Date().toISOString(), manager_comment: comment }
      : { status: 'returned', manager_comment: comment };
  const updated = await run<Row[]>(
    'save the decision',
    db().from('check_ins').update(patch).in('id', checkInIds).eq('status', 'submitted').select('id'),
  );
  if (updated.length === 0) throw new InvalidRequest('These days have already been decided. Please reload the page.');
  if (updated.length < checkInIds.length) {
    throw new InvalidRequest('Some of these days had already been decided. The others are done. Please reload the page.');
  }
}

async function liveRolesWithTopics(session: Session): Promise<RoleWithTopics[]> {
  const companyId = await liveManagerCompany(session);
  const roles = (await run<Row[]>('read the roles', db().from('roles').select('*').eq('company_id', companyId).order('title'))).map(toRole);
  const topics = await liveTopics(roles.map((r) => r.id));
  const approverIds = [...new Set(roles.map((r) => r.split_approved_by).filter((id): id is string => !!id))];
  const approvers = await Promise.all(approverIds.map(livePerson));
  return roles.map((role) => ({
    role,
    topics: topics.filter((t) => t.role_id === role.id),
    approved_by: approvers.find((p) => p?.id === role.split_approved_by) ?? null,
  }));
}

async function liveApproveSplit(session: Session, roleId: Uuid, topics: { topic_id: Uuid; expected_percent: number }[]): Promise<void> {
  const roles = await liveRolesWithTopics(session);
  const role = roles.find((r) => r.role.id === roleId);
  if (!role) throw new AccessDenied();
  validateSplit(role.topics, topics);
  await make.approveSplit({ role_id: roleId, approver_id: session.person_id, topics });
}

async function liveCandidates(session: Session): Promise<Candidate[]> {
  const companyId = await liveManagerCompany(session);
  const rows = await run<Row[]>('read the suggestions', db().from('candidates').select('*').eq('company_id', companyId).order('rank', { nullsFirst: false }));
  // A suggestion with no rank yet still gets a position, so the screen never shows rank 0.
  return rows.map(toCandidate).map((c, i) => (c.rank > 0 ? c : { ...c, rank: i + 1 }));
}
