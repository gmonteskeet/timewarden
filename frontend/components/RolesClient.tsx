'use client';

// Role cards: Scout's proposed split per role, which the manager can adjust and approve.

import { useState } from 'react';
import { approvedText } from '@/lib/dates';

export interface RoleCardData {
  id: string;
  title: string;
  document_name: string;
  document_url: string | null;
  read_label: string;
  approved_label: string | null;
  topics: { id: string; name: string; reasoning: string; expected: number; proposed: number }[];
}

const STEP = 5;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function RoleCard({ role }: { role: RoleCardData }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(role.topics.map((t) => [t.id, t.expected])));
  const [approvedLabel, setApprovedLabel] = useState<string | null>(role.approved_label);
  const [editing, setEditing] = useState(role.approved_label === null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const total = role.topics.reduce((s, t) => s + (values[t.id] ?? 0), 0);
  const reason = total === 100 ? null : `The split adds up to ${total} percent. It needs to add up to exactly 100 before you can approve it.`;
  const set = (id: string, n: number) => setValues((prev) => ({ ...prev, [id]: clamp(Math.round(n)) }));

  async function approve() {
    setSending(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/manager/roles/${encodeURIComponent(role.id)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topics: role.topics.map((t) => ({ topic_id: t.id, expected_percent: values[t.id] })) }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        role?: { role: { split_approved_at: string | null }; approved_by: { full_name: string } | null };
      };
      if (!res.ok || !data.ok || !data.role) {
        setProblem(data.message ?? 'The split could not be approved just now. Please try again.');
        return;
      }
      setApprovedLabel(approvedText(data.role.approved_by?.full_name ?? null, data.role.role.split_approved_at));
      setEditing(false);
    } catch {
      setProblem('The split could not be approved just now. Your numbers are safe. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="rounded-lg border border-line bg-white p-7" aria-labelledby={`role-${role.id}`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id={`role-${role.id}`} className="text-2xl font-semibold">
            {role.title}
          </h2>
          <p className="mt-1 text-lg text-muted">
            Role document:{' '}
            {role.document_url ? (
              <a href={role.document_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline focus-visible:outline-3 focus-visible:outline-accent">
                {role.document_name}
              </a>
            ) : (
              <span className="font-medium text-ink">{role.document_name}</span>
            )}
            . Scout last read this on {role.read_label}.
          </p>
        </div>
        {approvedLabel && !editing && (
          <div className="text-right">
            <p className="rounded bg-track px-4 py-2 text-lg font-semibold text-accent">{approvedLabel}</p>
            <button type="button" onClick={() => setEditing(true)} className="mt-2 text-base font-medium text-accent underline focus-visible:outline-3 focus-visible:outline-accent">
              Edit again
            </button>
          </div>
        )}
      </header>

      <ul>
        {role.topics.map((t) => {
          const value = values[t.id] ?? 0;
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{t.name}</p>
                <p className="text-base text-muted">{t.reasoning}</p>
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  {value !== t.proposed && <span className="mr-2 text-base text-muted">Scout proposed {t.proposed}</span>}
                  <button type="button" onClick={() => set(t.id, value - STEP)} aria-label={`Take ${STEP} off ${t.name}`} className="rounded border border-line px-3 py-2 text-lg font-medium hover:bg-track focus-visible:outline-3 focus-visible:outline-accent">
                    − {STEP}
                  </button>
                  <label className="sr-only" htmlFor={`pct-${t.id}`}>{`${t.name}, percent of time`}</label>
                  <input
                    id={`pct-${t.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(e) => set(t.id, Number(e.target.value || 0))}
                    className="w-20 rounded border border-line px-2 py-2 text-center text-xl font-semibold tabular-nums focus-visible:outline-3 focus-visible:outline-accent"
                  />
                  <span className="text-xl font-semibold">%</span>
                  <button type="button" onClick={() => set(t.id, value + STEP)} aria-label={`Add ${STEP} to ${t.name}`} className="rounded border border-line px-3 py-2 text-lg font-medium hover:bg-track focus-visible:outline-3 focus-visible:outline-accent">
                    + {STEP}
                  </button>
                </div>
              ) : (
                <p className="text-xl font-semibold tabular-nums">
                  {value}%{value !== t.proposed && <span className="ml-3 text-base font-normal text-muted">Scout proposed {t.proposed}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t-2 border-line pt-4">
        <p className={`text-xl font-semibold tabular-nums ${total === 100 ? 'text-ink' : 'text-outside'}`}>Total {total}%</p>
        {editing && (
          <div className="flex flex-wrap items-center gap-4">
            {reason && <p className="max-w-md text-lg text-outside">{reason}</p>}
            <button
              type="button"
              onClick={() => void approve()}
              disabled={reason !== null || sending}
              className="rounded-lg bg-accent px-8 py-3 text-xl font-semibold text-white hover:bg-accent-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {sending ? 'Approving' : 'Approve'}
            </button>
          </div>
        )}
      </footer>
      {problem && (
        <p role="alert" className="mt-4 rounded bg-note px-5 py-3 text-lg">
          {problem}
        </p>
      )}
    </article>
  );
}

export default function RolesClient({ roles }: { roles: RoleCardData[] }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/manager/roles/sync', { method: 'POST', signal: AbortSignal.timeout(40_000) });
      const data = (await res.json()) as { ok: boolean; message?: string; roles_read?: number; topics_proposed?: number };
      setResult(
        data.ok
          ? `${data.roles_read} role document${data.roles_read === 1 ? '' : 's'} read, ${data.topics_proposed} topic${data.topics_proposed === 1 ? '' : 's'} proposed. Approved splits are kept as they are.`
          : (data.message ?? 'Scout could not read the role documents just now. Please try again.'),
      );
    } catch {
      setResult('Scout could not read the role documents just now. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex min-h-14 flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="rounded-lg border-2 border-accent bg-white px-6 py-3 text-lg font-semibold text-accent hover:bg-track focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          Read the role documents again
        </button>
        <p aria-live="polite" className={`text-lg ${syncing ? 'animate-pulse text-accent' : 'text-muted'}`}>
          {syncing ? 'Scout is reading the role documents in the document store' : result}
        </p>
      </div>
      {roles.map((role) => (
        <RoleCard key={role.id} role={role} />
      ))}
    </div>
  );
}
