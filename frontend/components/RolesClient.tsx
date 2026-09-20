'use client';

// Role cards: Scout's proposed split per role, which the manager can adjust and approve.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnLink, btnPrimary, btnQuiet, btnQuietSmall, card, errorPanel, focusRing, waiting, warning } from '@/components/ui';
import { approvedText } from '@/lib/dates';

export interface RoleCardData {
  id: string;
  title: string;
  document_name: string;
  document_url: string | null;
  /** When Scout last read the document, in words, or null if it has not read it yet. */
  read_label: string | null;
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
        setProblem(data.message ?? 'The split could not be approved just now. Your numbers are safe.');
        return;
      }
      setApprovedLabel(approvedText(data.role.approved_by?.full_name ?? null, data.role.role.split_approved_at));
      setEditing(false);
    } catch {
      setProblem('The split could not be approved just now. Your numbers are safe.');
    } finally {
      setSending(false);
    }
  }

  return (
    <article className={card} aria-labelledby={`role-${role.id}`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id={`role-${role.id}`} className="text-2xl font-semibold">
            {role.title}
          </h2>
          <p className="mt-1 text-lg text-muted">
            {role.document_name && (
              <>
                Role document:{' '}
                {role.document_url ? (
                  <a href={role.document_url} target="_blank" rel="noopener noreferrer" className={`font-medium text-accent underline ${focusRing}`}>
                    {role.document_name}
                  </a>
                ) : (
                  <span className="font-medium text-ink">{role.document_name}</span>
                )}
                .{' '}
              </>
            )}
            {role.read_label ? `Scout last read this on ${role.read_label}.` : 'Scout has not read this document yet.'}
          </p>
        </div>
        {approvedLabel && !editing && (
          <div className="text-right">
            <p className="rounded bg-track px-4 py-2 text-lg font-semibold text-accent">{approvedLabel}</p>
            {role.topics.length > 0 && (
              <button type="button" onClick={() => setEditing(true)} className={`mt-2 ${btnLink}`}>
                Edit again
              </button>
            )}
          </div>
        )}
      </header>

      {role.topics.length === 0 && (
        <p className="border-t border-line py-4 text-lg">
          Scout has not proposed a split for this role yet. The topics appear here once Scout has read the role document, which takes about half a minute after you press Read the role documents again.
        </p>
      )}

      <ul>
        {role.topics.map((t) => {
          const value = values[t.id] ?? 0;
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{t.name}</p>
                {t.reasoning && <p className="text-base text-muted">{t.reasoning}</p>}
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  {value !== t.proposed && <span className="mr-2 text-base text-muted">Scout proposed {t.proposed}</span>}
                  <button type="button" onClick={() => set(t.id, value - STEP)} aria-label={`Take ${STEP} off ${t.name}`} className={btnQuietSmall}>
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
                    className={`w-20 rounded-lg border-2 border-line bg-white px-2 py-2 text-center text-xl font-semibold tabular-nums ${focusRing}`}
                  />
                  <span className="text-xl font-semibold">%</span>
                  <button type="button" onClick={() => set(t.id, value + STEP)} aria-label={`Add ${STEP} to ${t.name}`} className={btnQuietSmall}>
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

      {role.topics.length > 0 && (
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t-2 border-line pt-4">
        <p className={`text-xl font-semibold tabular-nums ${total === 100 ? 'text-ink' : 'text-warn'}`}>Total {total}%</p>
        {editing && (
          <div className="flex flex-wrap items-center gap-4">
            {reason && <p className={`max-w-md ${warning}`}>{reason}</p>}
            <button type="button" onClick={() => void approve()} disabled={reason !== null || sending} className={btnPrimary}>
              {sending ? 'Approving' : 'Approve'}
            </button>
          </div>
        )}
      </footer>
      )}
      {problem && (
        <div role="alert" className={`mt-4 ${errorPanel}`}>
          <p>{problem}</p>
          <button type="button" onClick={() => void approve()} disabled={sending} className={btnPrimary}>
            Try again
          </button>
        </div>
      )}
    </article>
  );
}

const POLL_EVERY_MS = 2_000;
const POLL_LIMIT_MS = 60_000;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const resultLine = (roles: number, topics: number) => `${plural(roles, 'role document')} read, ${plural(topics, 'topic')} proposed. Approved splits are kept as they are.`;

/** When make.com answers before it has finished, wait for the database to show a newer read. */
async function waitForRead(startedAt: number): Promise<string | null> {
  const since = startedAt - 5_000;
  while (Date.now() - startedAt < POLL_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
    try {
      const res = await fetch('/api/manager/roles/status', { cache: 'no-store' });
      const data = (await res.json()) as { ok: boolean; last_read_at?: string | null; roles?: number; topics?: number };
      if (data.ok && data.last_read_at && Date.parse(data.last_read_at) >= since) return resultLine(data.roles ?? 0, data.topics ?? 0);
    } catch {
      // A missed poll is fine: the next one tries again.
    }
  }
  return null;
}

export default function RolesClient({ roles }: { roles: RoleCardData[] }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function sync() {
    setSyncing(true);
    setResult(null);
    setFailed(false);
    const startedAt = Date.now();
    try {
      const res = await fetch('/api/manager/roles/sync', { method: 'POST', signal: AbortSignal.timeout(40_000) });
      const data = (await res.json()) as { ok: boolean; message?: string; roles_read?: number; topics_proposed?: number };
      if (!res.ok || !data.ok) {
        setFailed(true);
        setResult(data.message ?? 'Scout could not read the role documents just now.');
        return;
      }
      const line = typeof data.roles_read === 'number' && typeof data.topics_proposed === 'number' ? resultLine(data.roles_read, data.topics_proposed) : await waitForRead(startedAt);
      if (!line) {
        setFailed(true);
        setResult('Scout is taking longer than usual to read the role documents.');
        return;
      }
      setResult(line);
      router.refresh();
    } catch {
      setFailed(true);
      setResult('Scout could not read the role documents just now.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex min-h-16 flex-wrap items-center gap-4">
        <button type="button" onClick={() => void sync()} disabled={syncing} className={btnQuiet}>
          Read the role documents again
        </button>
        <p aria-live="polite" className={syncing ? `animate-pulse ${waiting}` : 'text-lg text-muted'}>
          {syncing ? 'Scout is reading the role documents in the document store' : result}
        </p>
        {failed && !syncing && (
          <button type="button" onClick={() => void sync()} className={btnPrimary}>
            Try again
          </button>
        )}
      </div>
      {roles.map((role) => (
        <RoleCard key={role.id} role={role} />
      ))}
    </div>
  );
}
