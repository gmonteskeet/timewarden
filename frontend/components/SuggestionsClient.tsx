'use client';

// Suggested workflows: review the approved history, then approve one to have it drafted in make.com.

import { useState } from 'react';
import type { Candidate } from '@/lib/contract';

const DECISION_TIMEOUT_MS = 40_000;
const POLL_EVERY_MS = 2_000;
const POLL_LIMIT_MS = 60_000;

const euros = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const hours = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const SCORES: { key: 'score_time' | 'score_repetitive' | 'score_reliability' | 'score_role_distance'; label: string }[] = [
  { key: 'score_time', label: 'Time cost' },
  { key: 'score_repetitive', label: 'Repetitiveness' },
  { key: 'score_reliability', label: 'Reliability risk' },
  { key: 'score_role_distance', label: 'Distance from the role' },
];

type CardState = { kind: 'idle' } | { kind: 'drafting' } | { kind: 'ready'; url: string } | { kind: 'failed'; message: string } | { kind: 'not_now' };

const primary =
  'rounded-lg bg-accent px-7 py-3 text-lg font-semibold text-white hover:bg-accent-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';
const secondary =
  'rounded-lg border-2 border-line bg-white px-6 py-3 text-lg font-semibold hover:bg-track focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';

/** Waits for the draft link: first from the decision reply, otherwise by reading the suggestion again. */
async function approveAndWait(candidateId: string): Promise<{ url: string } | { message: string }> {
  try {
    const res = await fetch(`/api/manager/candidates/${encodeURIComponent(candidateId)}/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approved', comment: null }),
      signal: AbortSignal.timeout(DECISION_TIMEOUT_MS),
    });
    const data = (await res.json()) as { ok: boolean; message?: string; make_scenario_url?: string | null };
    if (!res.ok || !data.ok) return { message: data.message ?? 'Scout could not start the draft just now.' };
    if (data.make_scenario_url) return { url: data.make_scenario_url };
  } catch {
    return { message: 'Scout is taking longer than usual to start the draft.' };
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
    try {
      const res = await fetch(`/api/manager/candidates/${encodeURIComponent(candidateId)}`, { cache: 'no-store' });
      const data = (await res.json()) as { ok: boolean; candidate?: Candidate };
      if (data.ok && data.candidate?.make_scenario_url) return { url: data.candidate.make_scenario_url };
    } catch {
      // A missed poll is fine: the next one tries again.
    }
  }
  return { message: 'The draft is taking longer than usual to appear in make.com.' };
}

function Card({ c, state, draftingElsewhere, onChange }: { c: Candidate; state: CardState; draftingElsewhere: boolean; onChange: (s: CardState) => void }) {
  async function approve() {
    onChange({ kind: 'drafting' });
    const result = await approveAndWait(c.id);
    onChange('url' in result ? { kind: 'ready', url: result.url } : { kind: 'failed', message: result.message });
  }

  const greyed = state.kind === 'not_now';
  return (
    <article className={`space-y-5 rounded-lg border bg-white p-7 ${greyed ? 'border-line opacity-50' : 'border-line'} ${state.kind === 'ready' ? 'border-2 border-accent' : ''}`} aria-labelledby={`cand-${c.id}`}>
      <header className="flex flex-wrap items-start gap-5">
        <p className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white" aria-label={`Rank ${c.rank}`}>
          {c.rank}
        </p>
        <div className="min-w-0 flex-1">
          <h2 id={`cand-${c.id}`} className="text-2xl font-semibold">
            {c.title}
          </h2>
          {c.description && <p className="mt-1 text-lg">{c.description}</p>}
        </div>
        <p className="text-right text-lg">
          <span className="block text-muted">Total score</span>
          <span className="text-3xl font-bold tabular-nums">{c.total_score.toFixed(2)}</span>
          <span className="text-muted"> out of 5</span>
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-4 rounded-lg bg-track px-5 py-4 text-lg">
        <div>
          <dt className="text-muted">People affected</dt>
          <dd className="text-2xl font-semibold tabular-nums">{c.people_affected}</dd>
        </div>
        <div>
          <dt className="text-muted">Team hours per week</dt>
          <dd className="text-2xl font-semibold tabular-nums">{hours.format(c.hours_per_week)}</dd>
        </div>
        <div>
          <dt className="text-muted">Cost per year</dt>
          <dd className="text-2xl font-semibold tabular-nums">{euros.format(c.annual_cost_eur)}</dd>
        </div>
      </dl>

      <ul className="grid grid-cols-2 gap-x-8 gap-y-3" aria-label="Scores out of 5">
        {SCORES.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            <span className="w-52 shrink-0 text-lg">{s.label}</span>
            <span className="h-4 flex-1 rounded bg-track">
              <span className="block h-4 rounded bg-actual" style={{ width: `${(c[s.key] / 5) * 100}%` }} />
            </span>
            <span className="w-16 text-lg font-semibold tabular-nums">{c[s.key]} of 5</span>
          </li>
        ))}
      </ul>

      {c.reasoning && <p className="max-w-4xl text-lg leading-relaxed">{c.reasoning}</p>}

      <div>
        <h3 className="mb-2 text-lg font-semibold">Proposed workflow</h3>
        <ol className="flex flex-wrap items-stretch gap-3">
          {c.proposed_steps.map((step, i) => (
            <li key={`${step.app}-${i}`} className="flex items-center gap-3">
              <div className="rounded-lg border border-line px-4 py-3" title={step.note}>
                <p className="text-base text-muted">Step {i + 1}</p>
                <p className="text-lg">
                  {step.app && <strong>{step.app}</strong>}
                  {step.app && step.action ? ': ' : ''}
                  {step.action}
                </p>
                {step.note && <p className="max-w-60 text-base text-muted">{step.note}</p>}
              </div>
              {i < c.proposed_steps.length - 1 && (
                <span aria-hidden="true" className="text-2xl text-muted">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="min-h-14">
        {state.kind === 'idle' && (
          <div className="flex flex-wrap gap-4">
            <button type="button" className={primary} disabled={draftingElsewhere} onClick={() => void approve()}>
              Approve
            </button>
            <button type="button" className={secondary} disabled={draftingElsewhere} onClick={() => onChange({ kind: 'not_now' })}>
              Not now
            </button>
          </div>
        )}
        {state.kind === 'not_now' && (
          <button type="button" className={secondary} onClick={() => onChange({ kind: 'idle' })}>
            Reconsider
          </button>
        )}
        {state.kind === 'drafting' && <p className="animate-pulse text-xl font-medium text-accent">Scout is drafting this in make.com</p>}
        {state.kind === 'failed' && (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-lg bg-note px-6 py-4 text-lg">
            <p>{state.message} Nothing has been lost.</p>
            <button type="button" className={primary} onClick={() => void approve()}>
              Try again
            </button>
          </div>
        )}
        {state.kind === 'ready' && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-track px-6 py-5">
            <p className="text-2xl font-semibold text-accent">Your draft is ready in make.com</p>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent px-8 py-4 text-xl font-semibold text-white hover:bg-accent-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Open the draft in make.com
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

interface Props {
  initialCandidates: Candidate[];
  periodStart: string;
  periodEnd: string;
  reviewingText: string;
}

export default function SuggestionsClient({ initialCandidates, periodStart, periodEnd, reviewingText }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [reviewing, setReviewing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(initialCandidates.filter((c) => c.make_scenario_url).map((c) => [c.id, { kind: 'ready', url: c.make_scenario_url! } as CardState])),
  );
  const drafting = Object.values(states).some((s) => s.kind === 'drafting');

  /** When make.com answers before it has finished, wait for new suggestions to appear. */
  async function waitForSuggestions(since: string): Promise<Candidate[] | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
      try {
        const res = await fetch(`/api/manager/suggestions?since=${encodeURIComponent(since)}`, { cache: 'no-store' });
        const data = (await res.json()) as { ok: boolean; candidates?: Candidate[]; complete?: boolean };
        if (data.ok && data.complete) return data.candidates ?? [];
      } catch {
        // A missed poll is fine: the next one tries again.
      }
    }
    return null;
  }

  async function review() {
    setReviewing(true);
    setProblem(null);
    try {
      const res = await fetch('/api/manager/suggestions/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
        signal: AbortSignal.timeout(DECISION_TIMEOUT_MS),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; candidates?: Candidate[]; complete?: boolean; since?: string };
      if (!res.ok || !data.ok) {
        setProblem(`${data.message ?? 'Scout could not review the history just now.'} Please try again.`);
        return;
      }
      const list = data.complete ? (data.candidates ?? []) : await waitForSuggestions(data.since ?? new Date().toISOString());
      if (!list) setProblem('Scout is taking longer than usual to review the history. Please try again.');
      else setCandidates(list);
    } catch {
      setProblem('Scout could not review the history just now. Please try again.');
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex min-h-14 flex-wrap items-center gap-4">
        <button type="button" onClick={() => void review()} disabled={reviewing || drafting} className={primary}>
          Review the last three weeks
        </button>
        <p aria-live="polite" className={`text-lg ${reviewing ? 'animate-pulse text-accent' : 'text-muted'}`}>
          {reviewing ? reviewingText : candidates.length > 0 ? `${candidates.length} suggestions, strongest first.` : ''}
        </p>
      </div>
      {problem && (
        <p role="alert" className="rounded-lg bg-note px-6 py-4 text-lg">
          {problem}
        </p>
      )}
      {!reviewing &&
        candidates.map((c) => (
          <Card
            key={c.id}
            c={c}
            state={states[c.id] ?? { kind: 'idle' }}
            draftingElsewhere={drafting && states[c.id]?.kind !== 'drafting'}
            onChange={(s) => setStates((prev) => ({ ...prev, [c.id]: s }))}
          />
        ))}
    </div>
  );
}
