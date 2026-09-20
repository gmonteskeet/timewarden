'use client';

// Submitted days waiting for the manager, one day at a time or a week at a time.

import { useState } from 'react';
import AllocationBars from '@/components/AllocationBars';
import { btnPrimary, btnQuiet, buttonRow, card, errorPanel, focusRing } from '@/components/ui';
import type { AllocationRow } from '@/lib/allocation-rows';

export interface DayCard {
  id: string;
  person_name: string;
  first_name: string;
  day_label: string;
  summary_text: string | null;
  rows: AllocationRow[];
}

export interface WeekCard {
  key: string;
  person_name: string;
  first_name: string;
  week_label: string;
  rows: AllocationRow[];
  submitted_ids: string[];
  approved_count: number;
}

const EMPTY = 'No days are waiting for you. A day appears here the moment one of your team submits it, usually during the morning.';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function decide(ids: string[], decision: 'approved' | 'returned', comment: string | null): Promise<string | null> {
  try {
    const res = await fetch('/api/manager/days/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ check_in_ids: ids, decision, comment }),
      signal: AbortSignal.timeout(40_000),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    return res.ok && data.ok ? null : (data.message ?? 'That could not be saved just now. Nothing has been lost.');
  } catch {
    return 'That could not be saved just now. Nothing has been lost.';
  }
}

function Day({ day, onDone }: { day: DayCard; onDone: (id: string, message: string) => void }) {
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastTried, setLastTried] = useState<'approved' | 'returned'>('approved');

  async function run(decision: 'approved' | 'returned') {
    if (decision === 'returned' && comment.trim() === '') {
      setProblem(`Please tell ${day.first_name} what needs changing before you return the day.`);
      return;
    }
    setLastTried(decision);
    setBusy(true);
    setProblem(null);
    const error = await decide([day.id], decision, decision === 'returned' ? comment.trim() : null);
    setBusy(false);
    if (error) return setProblem(error);
    onDone(day.id, decision === 'approved' ? `${day.first_name}'s ${day.day_label} is approved.` : `${day.first_name}'s ${day.day_label} has gone back to ${day.first_name} with your comment.`);
  }

  return (
    <article className={`space-y-4 ${card}`}>
      <h3 className="text-2xl font-semibold">{day.day_label}</h3>
      {day.summary_text && (
        <div className="max-w-4xl space-y-1">
          {/* Scout writes the summary to the employee, so the manager sees who it is addressed to. */}
          <p className="text-base text-muted">Scout&apos;s summary, as written to {day.first_name}:</p>
          <p className="text-lg leading-relaxed">{day.summary_text}</p>
        </div>
      )}
      <AllocationBars rows={day.rows} periodLabel={day.day_label} audience="manager" />
      {returning && (
        <div className="space-y-2">
          <label htmlFor={`comment-${day.id}`} className="block text-lg font-medium">
            What should {day.first_name} change?
          </label>
          <textarea
            id={`comment-${day.id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className={`w-full rounded-lg border border-line bg-white px-4 py-3 text-lg ${focusRing}`}
          />
        </div>
      )}
      <div className={buttonRow}>
        {!returning ? (
          <>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void run('approved')}>
              {busy ? 'Saving' : 'Approve'}
            </button>
            <button type="button" className={btnQuiet} disabled={busy} onClick={() => setReturning(true)}>
              Return
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btnPrimary} disabled={busy || comment.trim() === ''} onClick={() => void run('returned')}>
              {busy ? 'Saving' : `Return to ${day.first_name}`}
            </button>
            <button type="button" className={btnQuiet} disabled={busy} onClick={() => setReturning(false)}>
              Cancel
            </button>
            {comment.trim() === '' && <p className="text-lg text-muted">Write a comment to return the day.</p>}
          </>
        )}
      </div>
      {problem && (
        <div role="alert" className={errorPanel}>
          <p>{problem}</p>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void run(lastTried)}>
            Try again
          </button>
        </div>
      )}
    </article>
  );
}

function Week({ week, onDone }: { week: WeekCard; onDone: (ids: string[], message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const waiting = week.submitted_ids;

  async function approveWeek() {
    setBusy(true);
    setProblem(null);
    const error = await decide(waiting, 'approved', null);
    setBusy(false);
    if (error) return setProblem(error);
    onDone(waiting, `${week.first_name}'s week, ${week.week_label}: ${plural(waiting.length, 'day')} approved.`);
  }

  return (
    <article className={`space-y-4 ${card}`}>
      <h3 className="text-2xl font-semibold">
        {week.person_name}: {week.week_label}
      </h3>
      <p className="text-lg text-muted">
        {plural(waiting.length, 'day')} submitted and waiting, {week.approved_count} already approved.
      </p>
      <AllocationBars rows={week.rows} periodLabel={week.week_label} audience="manager" />
      {waiting.length === 0 ? (
        <p className="text-lg font-medium">Nothing is waiting for approval in this week.</p>
      ) : (
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void approveWeek()}>
          {busy ? 'Saving' : 'Approve the week'}
        </button>
      )}
      {problem && (
        <div role="alert" className={errorPanel}>
          <p>{problem}</p>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void approveWeek()}>
            Try again
          </button>
        </div>
      )}
    </article>
  );
}

export default function ApprovalsClient({ days, weeks }: { days: DayCard[]; weeks: WeekCard[] }) {
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<string[]>([]);

  const finish = (ids: string[], message: string) => {
    setDone((prev) => new Set([...prev, ...ids]));
    setMessages((prev) => [...prev, message]);
  };

  const openDays = days.filter((d) => !done.has(d.id));
  const people = [...new Set(openDays.map((d) => d.person_name))];
  const openWeeks = weeks.map((w) => ({ ...w, submitted_ids: w.submitted_ids.filter((id) => !done.has(id)), approved_count: w.approved_count + w.submitted_ids.filter((id) => done.has(id)).length }));

  return (
    <div className="space-y-6">
      {messages.length > 0 && (
        <ul aria-live="polite" className="space-y-1">
          {messages.map((m) => (
            <li key={m} className="w-fit rounded-full border border-success/15 bg-success-soft px-4 py-2 text-lg text-success">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="mr-2 inline-block h-5 w-5 align-[-3px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg>{m}
            </li>
          ))}
        </ul>
      )}

      {openDays.length === 0 ? (
        <p className="max-w-3xl text-xl text-muted">{EMPTY}</p>
      ) : (
        <>
          <div role="group" aria-label="Show days" className="scout-segments inline-flex rounded-xl border border-line bg-track p-1">
            {(['daily', 'weekly'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-lg px-5 py-2 text-lg font-medium ${focusRing} ${view === v ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-track'}`}
              >
                {v === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>

          {view === 'daily' &&
            people.map((name) => (
              <section key={name} className="space-y-4 pt-2" aria-label={name}>
                <h2 className="text-3xl font-bold">{name}</h2>
                {openDays
                  .filter((d) => d.person_name === name)
                  .map((d) => (
                    <Day key={d.id} day={d} onDone={(id, m) => finish([id], m)} />
                  ))}
              </section>
            ))}

          {view === 'weekly' && openWeeks.map((w) => <Week key={w.key} week={w} onDone={finish} />)}
        </>
      )}
    </div>
  );
}
