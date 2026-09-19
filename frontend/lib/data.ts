// Every read and write the screens need. Server only. Each function checks the session first:
// an employee can read and change only their own check ins; a manager can read the people whose
// manager_id is them, approve their days, approve role splits and decide on suggestions.
// Fixtures mode returns fake data; real data mode is wired to Supabase in task M8.
import 'server-only';

import type {
  Candidate,
  CheckIn,
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
import { getSession, type Session } from './session';

const fixturesMode = () => process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';

/** Thrown when the signed in person may not see or change something. Pages turn it into a refusal. */
export class AccessDenied extends Error {
  constructor(message = 'You do not have access to this.') {
    super(message);
    this.name = 'AccessDenied';
  }
}

function notWiredYet(): never {
  throw new Error('Real data is not wired yet, it arrives in task M8. Set NEXT_PUBLIC_USE_FIXTURES=true for now.');
}

async function signedIn(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AccessDenied('Please sign in first.');
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
}

export interface CheckInView {
  check_in: CheckIn;
  person: Person;
  role: Role;
  topics: Topic[];
  turns: InterviewTurn[];
  allocations: DayAllocation[];
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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function fxRole(roleId: Uuid): Role {
  const role = fx.roles.find((r) => r.id === roleId);
  if (!role) throw new Error(`Unknown role ${roleId}`);
  return role;
}

function fxTopics(roleId: Uuid): Topic[] {
  return fx.topics.filter((t) => t.role_id === roleId).sort((a, b) => a.sort_order - b.sort_order);
}

function fxView(checkIn: CheckIn): CheckInView {
  const person = fx.people.find((p) => p.id === checkIn.person_id)!;
  return {
    check_in: checkIn,
    person,
    role: fxRole(person.role_id),
    topics: fxTopics(person.role_id),
    turns: fx.interviewTurns.filter((t) => t.check_in_id === checkIn.id).sort((a, b) => a.turn_no - b.turn_no),
    allocations: fx.dayAllocations.filter((a) => a.check_in_id === checkIn.id),
  };
}

/** Rights for one check in: the owner, or the owner's manager. */
function mayReadCheckIn(session: Session, checkIn: CheckIn): boolean {
  if (checkIn.person_id === session.person_id) return true;
  if (session.app_role !== 'manager') return false;
  const owner = fx.people.find((p) => p.id === checkIn.person_id);
  return owner?.manager_id === session.person_id;
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
  const checkIn = fx.checkIns.find((c) => c.id === checkInId);
  if (!checkIn || !mayReadCheckIn(session, checkIn)) throw new AccessDenied();
  return fxView(checkIn);
}

/** The signed in employee's own check ins, newest first. */
export async function listMyCheckIns(): Promise<CheckIn[]> {
  const session = await signedIn();
  if (!fixturesMode()) notWiredYet();
  return fx.checkIns.filter((c) => c.person_id === session.person_id).sort((a, b) => b.day.localeCompare(a.day));
}

/** Every role in the manager's company with its topics. */
export async function listRolesWithTopics(): Promise<RoleWithTopics[]> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return fx.roles.map((role) => ({ role, topics: fxTopics(role.id) }));
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
  const team = new Set(fxTeam(session.person_id).map((p) => p.id));
  return fx.checkIns.filter((c) => team.has(c.person_id) && c.status === 'submitted').map(fxView);
}

/** Approved allocations for the manager's team in a period, for the team bars on Suggestions. */
export async function getTeamAllocations(periodStart: IsoDate, periodEnd: IsoDate): Promise<DayAllocation[]> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  const team = new Set(fxTeam(session.person_id).map((p) => p.id));
  const approved = new Set(fx.checkIns.filter((c) => c.status === 'approved').map((c) => c.id));
  return fx.dayAllocations.filter(
    (a) => team.has(a.person_id) && approved.has(a.check_in_id) && a.day >= periodStart && a.day <= periodEnd,
  );
}

/** Suggested workflows for the company, ranked. */
export async function listCandidates(): Promise<Candidate[]> {
  await asManager();
  if (!fixturesMode()) notWiredYet();
  return [...fx.candidates].sort((a, b) => a.rank - b.rank);
}

// ---------------------------------------------------------------------------
// Writes. Each checks rights, then calls the matching make.com webhook.
// Fixtures mode keeps no state: replies are canned and nothing is saved.
// ---------------------------------------------------------------------------

async function ownCheckIn(checkInId: Uuid): Promise<{ session: Session; checkIn: CheckIn }> {
  const session = await signedIn();
  if (!fixturesMode()) notWiredYet();
  const checkIn = fx.checkIns.find((c) => c.id === checkInId);
  if (!checkIn || checkIn.person_id !== session.person_id) throw new AccessDenied();
  return { session, checkIn };
}

/** Sends one answer (or null to start) and returns Scout's next line. turnsSoFar is used in fixtures mode. */
export async function sendInterviewAnswer(checkInId: Uuid, employeeText: string | null, turnsSoFar: number): Promise<InterviewReply> {
  await ownCheckIn(checkInId);
  return make.interviewTurn({ check_in_id: checkInId, employee_text: employeeText }, { turnsSoFar });
}

/** The employee submits their day, with any corrected minutes. */
export async function submitCheckIn(checkInId: Uuid, adjustments: { allocation_id: Uuid; minutes: number }[]): Promise<void> {
  await ownCheckIn(checkInId);
  await make.submitDay({ check_in_id: checkInId, adjustments });
}

/** The manager approves or returns submitted days of their own team. */
export async function decideOnDays(checkInIds: Uuid[], decision: DayDecision, comment: string | null): Promise<void> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  for (const id of checkInIds) {
    const checkIn = fx.checkIns.find((c) => c.id === id);
    if (!checkIn || !mayReadCheckIn(session, checkIn) || checkIn.person_id === session.person_id) throw new AccessDenied();
  }
  await make.decideDays({ check_in_ids: checkInIds, approver_id: session.person_id, decision, comment });
}

/** The manager approves a role's split. The percents must add up to 100. */
export async function approveRoleSplit(roleId: Uuid, topics: { topic_id: Uuid; expected_percent: number }[]): Promise<void> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  if (!fx.roles.some((r) => r.id === roleId)) throw new AccessDenied();
  const total = topics.reduce((s, t) => s + t.expected_percent, 0);
  if (total !== 100) throw new Error(`The split adds up to ${total}, not 100.`);
  await make.approveSplit({ role_id: roleId, approver_id: session.person_id, topics });
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
  return make.suggestWorkflows({ company_id: fx.company.id, period_start: periodStart, period_end: periodEnd });
}

/** The manager approves or rejects a suggestion. Approval returns the draft scenario link. */
export async function decideOnCandidate(candidateId: Uuid, decision: Decision, comment: string | null): Promise<DecisionReply> {
  const session = await asManager();
  if (!fixturesMode()) notWiredYet();
  if (!fx.candidates.some((c) => c.id === candidateId)) throw new AccessDenied();
  return make.decideCandidate({ candidate_id: candidateId, approver_id: session.person_id, decision, comment });
}
