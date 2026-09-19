// Every read and write the screens need. Server only. Each function checks the session first:
// an employee can read and change only their own check ins; a manager can read the people whose
// manager_id is them, approve their days, approve role splits and decide on suggestions.
// Fixtures mode returns fake data; real data mode is wired to Supabase in task M8.
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

function notWiredYet(): never {
  throw new Error('Real data is not wired yet, it arrives in task M8. Set NEXT_PUBLIC_USE_FIXTURES=true for now.');
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
  access_token: string;
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

/** The labelled demo sign in list on the home page, for judges. Public by design. */
export async function listDemoSignIns(): Promise<DemoSignIn[]> {
  if (!fixturesMode()) notWiredYet();
  return fx.people.map((p) => ({
    full_name: p.full_name,
    role_title: fxRole(p.role_id).title,
    app_role: p.app_role,
    access_token: p.access_token,
  }));
}

/** Used by /enter/[token] to turn a personal link into a session. */
export async function findPersonByToken(token: string): Promise<Person | null> {
  if (!fixturesMode()) notWiredYet();
  return fx.people.find((p) => p.access_token === token) ?? null;
}

/** Where a person lands after signing in when the link has no next path. */
export async function landingPathFor(person: Person): Promise<string> {
  if (!fixturesMode()) notWiredYet();
  return fx.fixtureLandingPath(person);
}

/** Whether the home page offers "Reset the demo". True only in fixtures mode. */
export async function canResetDemo(): Promise<boolean> {
  return fixturesMode();
}

/** Clears the demo progress. Fixtures mode only; call from a route handler. */
export async function resetDemo(): Promise<void> {
  if (!fixturesMode()) return;
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The signed in person and their role, or null when nobody is signed in. */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const session = await getSession();
  if (!session) return null;
  if (!fixturesMode()) notWiredYet();
  const person = fx.people.find((p) => p.id === session.person_id);
  if (!person) return null;
  return { person, role: fxRole(person.role_id) };
}

/** One check in with its interview and allocations. Owner or the owner's manager only. */
export async function getCheckIn(checkInId: Uuid): Promise<CheckInView> {
  const session = await signedIn();
  if (!fixturesMode()) notWiredYet();
  const state = await readDemoState();
  const checkIn = fxCheckIns(state).find((c) => c.id === checkInId);
  if (!checkIn || !mayReadCheckIn(session, checkIn)) throw new AccessDenied();
  return fxView(checkIn, state);
}

/** The status of the signed in employee's own check in, for polling. */
export async function getCheckInStatus(checkInId: Uuid): Promise<CheckInStatus> {
  const { checkIn } = await ownCheckIn(checkInId);
  return checkIn.status;
}

/** The scripted answer to Scout's current question, when a script exists (fixtures mode). */
export async function getSuggestedAnswer(checkInId: Uuid): Promise<string | null> {
  const { state } = await ownCheckIn(checkInId);
  return suggestionFor(checkInId, state.c[checkInId]);
}

/** The signed in employee's own check ins, newest first. */
export async function listMyCheckIns(): Promise<CheckIn[]> {
  const session = await signedIn();
  if (!fixturesMode()) notWiredYet();
  const state = await readDemoState();
  return fxCheckIns(state)
    .filter((c) => c.person_id === session.person_id)
    .sort((a, b) => b.day.localeCompare(a.day));
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
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return fxRolesWithTopics(await readDemoState());
}

/** The manager's team. */
export async function listTeam(): Promise<Person[]> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  return fxTeam(session.person_id);
}

/** Days the manager's team has submitted and that wait for approval. */
export async function listDaysAwaitingApproval(): Promise<CheckInView[]> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
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
  if (!fixturesMode()) notWiredYet();
  const state = await readDemoState();
  const all = fxCheckIns(state);
  const team = fxTeam(session.person_id);
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
        topics: fxTopics(person.role_id),
        allocations: days.flatMap((c) => fxAllocations(c, state)),
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
  if (!fixturesMode()) notWiredYet();
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
  if (!fixturesMode()) notWiredYet();
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
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return fxCandidates(await readDemoState());
}

/** One suggestion, for polling until its draft link appears. */
export async function getCandidate(candidateId: Uuid): Promise<Candidate> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  const candidate = fxCandidates(await readDemoState()).find((c) => c.id === candidateId);
  if (!candidate) throw new AccessDenied();
  return candidate;
}

// ---------------------------------------------------------------------------
// Writes. Each checks rights, then calls the matching make.com webhook.
// ---------------------------------------------------------------------------

async function ownCheckIn(checkInId: Uuid): Promise<{ session: Session; checkIn: CheckIn; state: DemoState }> {
  const session = await signedIn();
  if (!fixturesMode()) notWiredYet();
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
  const { checkIn, state } = await ownCheckIn(checkInId);
  const text = employeeText === null ? null : employeeText.trim();
  if (text !== null && text.length === 0) throw new InvalidRequest('Please write or say an answer first.');
  if (text !== null && text.length > MAX_ANSWER_LENGTH) throw new InvalidRequest(`Please keep each answer under ${MAX_ANSWER_LENGTH} characters.`);
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
  if (!fixturesMode()) notWiredYet();
  const text = comment?.trim() || null;
  if (decision !== 'approved' && decision !== 'returned') throw new InvalidRequest('Please choose approve or return.');
  if (decision === 'returned' && !text) throw new InvalidRequest('Please say what needs changing before you return the day.');
  if (checkInIds.length === 0) throw new InvalidRequest('Please choose at least one day.');
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

/** The manager approves a role's split. The percents must add up to 100. */
export async function approveRoleSplit(roleId: Uuid, topics: { topic_id: Uuid; expected_percent: number }[]): Promise<void> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  if (!fx.roles.some((r) => r.id === roleId)) throw new AccessDenied();
  const roleTopics = fxTopics(roleId);
  const byId = new Map(topics.map((t) => [t.topic_id, t.expected_percent]));
  if (topics.length !== roleTopics.length || roleTopics.some((t) => !byId.has(t.id))) {
    throw new InvalidRequest('Every topic of the role needs a number.');
  }
  if (topics.some((t) => !Number.isInteger(t.expected_percent) || t.expected_percent < 0 || t.expected_percent > 100)) {
    throw new InvalidRequest('Each share must be a whole number from 0 to 100.');
  }
  const total = topics.reduce((s, t) => s + t.expected_percent, 0);
  if (total !== 100) throw new InvalidRequest(`The split adds up to ${total} percent. It needs to add up to 100.`);
  await make.approveSplit({ role_id: roleId, approver_id: session.person_id, topics });
  const state = await readDemoState();
  state.r = { ...(state.r ?? {}), [roleId]: { p: roleTopics.map((t) => byId.get(t.id)!), at: Date.now(), by: session.person_id } };
  await writeDemoState(state);
}

/** Asks Scout to read the role documents again and propose splits. */
export async function rereadRoleDocuments(): Promise<RolesSyncReply> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return make.syncRoles({ company_id: fx.company.id });
}

/** Runs the morning routine now for a day. */
export async function runMorningRoutine(day: IsoDate): Promise<MorningRunReply> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return make.runMorning({ company_id: fx.company.id, day });
}

/** Asks Scout to review approved history in a period and suggest workflows. */
export async function reviewHistory(periodStart: IsoDate, periodEnd: IsoDate): Promise<SuggestReply> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  const reply = await make.suggestWorkflows({ company_id: fx.company.id, period_start: periodStart, period_end: periodEnd });
  const state = await readDemoState();
  state.rv = Date.now();
  await writeDemoState(state);
  return reply;
}

/** The manager approves or rejects a suggestion. Approval returns the draft scenario link. */
export async function decideOnCandidate(candidateId: Uuid, decision: Decision, comment: string | null): Promise<DecisionReply> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  if (decision !== 'approved' && decision !== 'rejected') throw new InvalidRequest('Please choose approve or not now.');
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
