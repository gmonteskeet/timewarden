// Shared data contract, version 2. Mirrors AGENTS.md sections 5 and 6 field for field.
// Shared file: no field name changes without both humans (Marcus and Gerson) agreeing.

// ---------------------------------------------------------------------------
// Database tables (AGENTS.md section 5)
// ---------------------------------------------------------------------------

export type Uuid = string;
/** ISO 8601 timestamp with time zone, as Postgres timestamptz returns it. */
export type Timestamp = string;
/** Calendar date, YYYY-MM-DD. */
export type IsoDate = string;

export type SplitStatus = 'proposed' | 'approved';
export type AppRole = 'manager' | 'employee';
export type ActivitySource = 'calendar' | 'transcript' | 'interview';
export type CheckInStatus = 'invited' | 'in_progress' | 'summarised' | 'submitted' | 'approved' | 'returned';
export type Speaker = 'scout' | 'employee';
export type TurnKind = 'opening' | 'calendar_gap' | 'unexplained_meeting' | 'elaboration' | 'confirmation' | 'closing';
export type CandidateStatus = 'proposed' | 'approved' | 'rejected' | 'drafted';
export type Decision = 'approved' | 'rejected';
export type DayDecision = 'approved' | 'returned';

export interface Company {
  id: Uuid;
  name: string;
  created_at: Timestamp;
}

export interface Role {
  id: Uuid;
  company_id: Uuid;
  title: string;
  document_name: string;
  document_url: string | null;
  job_description: string;
  kpis: string[];
  split_status: SplitStatus;
  split_approved_by: Uuid | null;
  split_approved_at: Timestamp | null;
  source_read_at: Timestamp;
  created_at: Timestamp;
}

export interface Topic {
  id: Uuid;
  role_id: Uuid;
  name: string;
  description: string;
  expected_percent: number;
  proposed_percent: number;
  reasoning: string;
  sort_order: number;
  created_at: Timestamp;
}

export interface Person {
  id: Uuid;
  company_id: Uuid;
  role_id: Uuid;
  full_name: string;
  email: string;
  app_role: AppRole;
  team: string;
  manager_id: Uuid | null;
  hourly_cost_eur: number;
  calendar_id: string | null;
  access_token: string;
  working_minutes_per_day: number;
  created_at: Timestamp;
}

export interface Activity {
  id: Uuid;
  person_id: Uuid;
  day: IsoDate;
  source: ActivitySource;
  title: string;
  description: string | null;
  starts_at: Timestamp | null;
  ends_at: Timestamp | null;
  minutes: number;
  attendees: string[];
  created_at: Timestamp;
}

export interface Transcript {
  id: Uuid;
  person_id: Uuid;
  title: string;
  occurred_at: Timestamp;
  minutes: number;
  in_calendar: boolean;
  body: string;
  created_at: Timestamp;
}

export interface CheckIn {
  id: Uuid;
  person_id: Uuid;
  day: IsoDate;
  status: CheckInStatus;
  invited_at: Timestamp;
  submitted_at: Timestamp | null;
  approved_by: Uuid | null;
  approved_at: Timestamp | null;
  manager_comment: string | null;
  summary_text: string | null;
  created_at: Timestamp;
}

export interface InterviewTurn {
  id: Uuid;
  check_in_id: Uuid;
  turn_no: number;
  speaker: Speaker;
  text: string;
  kind: TurnKind | null;
  evidence: string | null;
  created_at: Timestamp;
}

export interface DayAllocation {
  id: Uuid;
  check_in_id: Uuid;
  person_id: Uuid;
  day: IsoDate;
  topic_id: Uuid | null;
  label: string;
  in_role: boolean;
  minutes: number;
  percent: number;
  evidence: string;
  employee_adjusted: boolean;
  created_at: Timestamp;
}

export interface ProposedStep {
  app: string;
  action: string;
  note: string;
}

export interface Candidate {
  id: Uuid;
  company_id: Uuid;
  title: string;
  description: string;
  source_label: string;
  people_affected: number;
  hours_per_week: number;
  annual_cost_eur: number;
  period_start: IsoDate;
  period_end: IsoDate;
  score_time: number;
  score_repetitive: number;
  score_reliability: number;
  score_role_distance: number;
  total_score: number;
  rank: number;
  reasoning: string;
  proposed_steps: ProposedStep[];
  status: CandidateStatus;
  make_scenario_id: string | null;
  make_scenario_url: string | null;
  created_at: Timestamp;
}

export interface Approval {
  id: Uuid;
  candidate_id: Uuid;
  approver_id: Uuid;
  decision: Decision;
  comment: string | null;
  created_at: Timestamp;
}

// ---------------------------------------------------------------------------
// Webhooks (AGENTS.md section 6). Every request carries the header x-scout-key.
// Every reply is JSON with ok: true plus the fields below.
// ---------------------------------------------------------------------------

export interface WebhookReplyBase {
  ok: boolean;
}

/** MAKE_WEBHOOK_ROLES_SYNC: read role documents and propose splits. */
export interface RolesSyncRequest {
  company_id: Uuid;
}
export interface RolesSyncReply extends WebhookReplyBase {
  roles_read: number;
  topics_proposed: number;
}

/** MAKE_WEBHOOK_SPLIT_APPROVAL: manager approves a role's split. */
export interface SplitApprovalRequest {
  role_id: Uuid;
  approver_id: Uuid;
  topics: { topic_id: Uuid; expected_percent: number }[];
}
export type SplitApprovalReply = WebhookReplyBase;

/** MAKE_WEBHOOK_MORNING_RUN: run the morning routine now. */
export interface MorningRunRequest {
  company_id: Uuid;
  day: IsoDate;
}
export interface MorningRunReply extends WebhookReplyBase {
  check_ins_created: number;
  emails_sent: number;
}

/** MAKE_WEBHOOK_INTERVIEW: one interview turn. employee_text is null on the first call. */
export interface InterviewRequest {
  check_in_id: Uuid;
  employee_text: string | null;
}
export interface InterviewReply extends WebhookReplyBase {
  done: boolean;
  turn_no: number;
  question: string;
  kind: TurnKind;
  evidence: string;
}

/** MAKE_WEBHOOK_SUBMIT: employee submits the day. */
export interface SubmitRequest {
  check_in_id: Uuid;
  /**
   * One entry per row the employee changed. `allocation_id` is normally the id of an existing
   * `day_allocations` row.
   *
   * A role topic that Scout recorded no time for has no row to point at, so for those the screen
   * sends the text `topic:` followed by the topic's id instead, and the server creates the row on
   * submit. The shape of the request is deliberately unchanged, so nothing else has to know.
   * Scenario six would not understand a `topic:` id, so if `MAKE_WEBHOOK_SUBMIT` is ever set, a
   * submit carrying one is refused rather than sent on. See `frontend/lib/data.ts`.
   */
  adjustments: { allocation_id: Uuid; minutes: number }[];
}
export type SubmitReply = WebhookReplyBase;

/** MAKE_WEBHOOK_DAY_APPROVAL: manager approves or returns days. */
export interface DayApprovalRequest {
  check_in_ids: Uuid[];
  approver_id: Uuid;
  decision: DayDecision;
  comment: string | null;
}
export type DayApprovalReply = WebhookReplyBase;

/** MAKE_WEBHOOK_SUGGEST: review history and suggest workflows. */
export interface SuggestRequest {
  company_id: Uuid;
  period_start: IsoDate;
  period_end: IsoDate;
}
export interface SuggestReply extends WebhookReplyBase {
  candidates_created: number;
}

/** MAKE_WEBHOOK_DECISION: manager decides on a suggestion. */
export interface DecisionRequest {
  candidate_id: Uuid;
  approver_id: Uuid;
  decision: Decision;
  comment: string | null;
}
export interface DecisionReply extends WebhookReplyBase {
  /** Present when the decision is approved. */
  make_scenario_url?: string;
}

// ---------------------------------------------------------------------------
// Scoring formula (AGENTS.md section 5). make.com computes it for real data;
// the fixtures use the same function so both sides agree.
// ---------------------------------------------------------------------------

export function totalScore(c: Pick<Candidate, 'score_time' | 'score_repetitive' | 'score_reliability' | 'score_role_distance'>): number {
  const raw = 0.35 * c.score_time + 0.2 * c.score_repetitive + 0.15 * c.score_reliability + 0.3 * c.score_role_distance;
  return Math.round(raw * 100) / 100;
}

/** Working weeks in a year for annual cost: hours per week * 46 * hourly cost (AGENTS.md section 5). */
export const WORKING_WEEKS_PER_YEAR = 46;
