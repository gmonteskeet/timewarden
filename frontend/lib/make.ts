// One function per make.com webhook in AGENTS.md section 6. Server only: webhook addresses and the
// shared secret never reach the browser. In fixtures mode each function returns a canned reply.
import 'server-only';

import type {
  DayApprovalReply,
  DayApprovalRequest,
  DecisionReply,
  DecisionRequest,
  InterviewReply,
  InterviewRequest,
  MorningRunReply,
  MorningRunRequest,
  RolesSyncReply,
  RolesSyncRequest,
  SplitApprovalReply,
  SplitApprovalRequest,
  SubmitReply,
  SubmitRequest,
  SuggestReply,
  SuggestRequest,
} from './contract';
import { fixtureDraftUrl, scoutScriptFor } from './fixtures';

const fixturesMode = () => process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';
const FIXTURE_DELAY_MS = 800;
const pause = () => new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));

type WebhookEnv =
  | 'MAKE_WEBHOOK_ROLES_SYNC'
  | 'MAKE_WEBHOOK_SPLIT_APPROVAL'
  | 'MAKE_WEBHOOK_MORNING_RUN'
  | 'MAKE_WEBHOOK_INTERVIEW'
  | 'MAKE_WEBHOOK_SUBMIT'
  | 'MAKE_WEBHOOK_DAY_APPROVAL'
  | 'MAKE_WEBHOOK_SUGGEST'
  | 'MAKE_WEBHOOK_DECISION';

async function callWebhook<Reply>(envName: WebhookEnv, body: unknown, timeoutMs: number): Promise<Reply> {
  const url = process.env[envName];
  const key = process.env.SCOUT_SHARED_SECRET;
  if (!url) throw new Error(`${envName} is not set.`);
  if (!key) throw new Error('SCOUT_SHARED_SECRET is not set.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-scout-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`make.com replied ${response.status} to ${envName}.`);
  const reply = (await response.json()) as Reply & { ok?: boolean };
  if (reply.ok !== true) throw new Error(`make.com did not confirm ${envName}.`);
  return reply;
}

const SLOW = 40_000;
const INTERVIEW = 12_000;

export async function syncRoles(body: RolesSyncRequest): Promise<RolesSyncReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true, roles_read: 4, topics_proposed: 20 };
  }
  return callWebhook('MAKE_WEBHOOK_ROLES_SYNC', body, SLOW);
}

export async function approveSplit(body: SplitApprovalRequest): Promise<SplitApprovalReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true };
  }
  return callWebhook('MAKE_WEBHOOK_SPLIT_APPROVAL', body, SLOW);
}

export async function runMorning(body: MorningRunRequest): Promise<MorningRunReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true, check_ins_created: 3, emails_sent: 3 };
  }
  return callWebhook('MAKE_WEBHOOK_MORNING_RUN', body, SLOW);
}

/**
 * One interview turn. In fixtures mode there is no state on the server: the caller passes
 * turnsSoFar, the number of turns already shown before this call (0 on the first call),
 * and the scripted reply is chosen from the check in id and that number.
 */
export async function interviewTurn(body: InterviewRequest, fixtures?: { turnsSoFar: number }): Promise<InterviewReply> {
  if (fixturesMode()) {
    await pause();
    const script = scoutScriptFor(body.check_in_id);
    const turnsSoFar = Math.max(0, fixtures?.turnsSoFar ?? 0);
    const index = Math.min(Math.floor((turnsSoFar + 1) / 2), script.length - 1);
    const line = script[index];
    const turn_no = turnsSoFar + (body.employee_text === null ? 1 : 2);
    return { ok: true, done: line.kind === 'closing', turn_no, question: line.question, kind: line.kind, evidence: line.evidence };
  }
  return callWebhook('MAKE_WEBHOOK_INTERVIEW', body, INTERVIEW);
}

export async function submitDay(body: SubmitRequest): Promise<SubmitReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true };
  }
  return callWebhook('MAKE_WEBHOOK_SUBMIT', body, SLOW);
}

export async function decideDays(body: DayApprovalRequest): Promise<DayApprovalReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true };
  }
  return callWebhook('MAKE_WEBHOOK_DAY_APPROVAL', body, SLOW);
}

export async function suggestWorkflows(body: SuggestRequest): Promise<SuggestReply> {
  if (fixturesMode()) {
    await pause();
    return { ok: true, candidates_created: 4 };
  }
  return callWebhook('MAKE_WEBHOOK_SUGGEST', body, SLOW);
}

export async function decideCandidate(body: DecisionRequest): Promise<DecisionReply> {
  if (fixturesMode()) {
    await pause();
    return body.decision === 'approved' ? { ok: true, make_scenario_url: fixtureDraftUrl(body.candidate_id) } : { ok: true };
  }
  return callWebhook('MAKE_WEBHOOK_DECISION', body, SLOW);
}
