'use client';

// Suggested workflows: review the approved history, then approve one to have it drafted in make.com.

import { useState } from 'react';
import { btnPrimary, btnQuiet, buttonRow, card, cardHighlighted, errorPanel, waiting } from '@/components/ui';
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
    <article className={`space-y-5 ${state.kind === 'ready' ? cardHighlighted : card} ${greyed ? 'opacity-50' : ''}`} aria-labelledby={`cand-${c.id}`}>
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
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {c.proposed_steps.map((step, i) => (
            <li key={`${step.app}-${i}`} className="h-full space-y-1 rounded-lg border border-line bg-white px-4 py-3">
              <p className="text-base font-medium text-muted">Step {i + 1}</p>
              <p className="text-lg leading-snug">
                {step.app && <strong>{step.app}</strong>}
                {step.app && step.action ? ': ' : ''}
                {step.action}
              </p>
              {step.note && <p className="text-base leading-snug text-muted">{step.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex min-h-20 items-center">
        {state.kind === 'idle' && (
          <div className={buttonRow}>
            <button type="button" className={btnPrimary} disabled={draftingElsewhere} onClick={() => void approve()}>
              Approve
            </button>
            <button type="button" className={btnQuiet} disabled={draftingElsewhere} onClick={() => onChange({ kind: 'not_now' })}>
              Not now
            </button>
          </div>
        )}
        {state.kind === 'not_now' && (
          <button type="button" className={btnQuiet} onClick={() => onChange({ kind: 'idle' })}>
            Reconsider
          </button>
        )}
        {state.kind === 'drafting' && <p className={`animate-pulse ${waiting}`}>Scout is building this scenario in make.com now</p>}
        {state.kind === 'failed' && (
          <div role="alert" className={errorPanel}>
            <p>{state.message} Nothing has been lost.</p>
            <button type="button" className={btnPrimary} onClick={() => void approve()}>
              Try again
            </button>
          </div>
        )}
        {state.kind === 'ready' && (
          <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-lg bg-track px-6 py-5">
            <p className="text-2xl font-semibold text-accent">Your draft is ready in make.com</p>
            <a href={state.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
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
        setProblem(data.message ?? 'Scout could not review the history just now.');
        return;
      }
      const list = data.complete ? (data.candidates ?? []) : await waitForSuggestions(data.since ?? new Date().toISOString());
      if (!list) setProblem('Scout is taking longer than usual to review the history.');
      else setCandidates(list);
    } catch {
      setProblem('Scout could not review the history just now.');
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex min-h-16 flex-wrap items-center gap-4">
        <button type="button" onClick={() => void review()} disabled={reviewing || drafting} className={btnQuiet}>
          Review the last three weeks
        </button>
        <p aria-live="polite" className={reviewing ? `animate-pulse ${waiting}` : 'text-lg text-muted'}>
          {reviewing ? reviewingText : candidates.length > 0 ? `${candidates.length} suggestions, strongest first.` : ''}
        </p>
      </div>
      {problem && (
        <div role="alert" className={errorPanel}>
          <p>{problem}</p>
          <button type="button" onClick={() => void review()} disabled={reviewing} className={btnPrimary}>
            Try again
          </button>
        </div>
      )}
      {reviewing ? (
        <div className={`flex min-h-64 items-center justify-center ${card}`}>
          <p className={`animate-pulse ${waiting}`}>{reviewingText}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className={`min-h-64 ${card}`}>
          <p className="max-w-3xl text-xl text-muted">
            No suggestions yet. Press Review the last three weeks, and the ranked cards appear here in about half a minute, strongest first.
          </p>
        </div>
      ) : (
        candidates.map((c) => (
          <Card
            key={c.id}
            c={c}
            state={states[c.id] ?? { kind: 'idle' }}
            draftingElsewhere={drafting && states[c.id]?.kind !== 'drafting'}
            onChange={(s) => setStates((prev) => ({ ...prev, [c.id]: s }))}
          />
        ))
      )}
    </div>
  );
}
