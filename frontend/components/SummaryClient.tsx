'use client';

// The day's summary: expected against actual, with corrections in steps of 15 minutes and Submit.

import { useMemo, useState } from 'react';
import AllocationBars from '@/components/AllocationBars';
import { btnLink, btnPrimary, card, errorPanel, waiting as waitingWords, warning } from '@/components/ui';
import { formatMinutes, type AllocationRow } from '@/lib/allocation-rows';
import type { CheckInStatus } from '@/lib/contract';

interface Props {
  checkInId: string;
  summaryText: string | null;
  periodLabel: string;
  rows: AllocationRow[];
  workingMinutes: number;
  status: CheckInStatus;
  editable: boolean;
  audience: 'self' | 'manager';
  managerFirstName: string;
  managerComment: string | null;
}

function statusInWords(status: CheckInStatus, manager: string, own: boolean): string | null {
  if (status === 'submitted') return own ? `Sent to ${manager} for approval.` : 'Submitted and waiting for approval.';
  if (status === 'approved') return `Approved by ${manager}.`;
  return null;
}

export default function SummaryClient(props: Props) {
  const { checkInId, summaryText, periodLabel, workingMinutes, audience, managerFirstName, managerComment } = props;
  const original = useMemo(() => new Map(props.rows.map((r) => [r.key, r.minutes])), [props.rows]);
  const [minutes, setMinutes] = useState<Map<string, number>>(() => new Map(original));
  const [status, setStatus] = useState<CheckInStatus>(props.status);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const readOnly = !props.editable || status === 'submitted' || status === 'approved';
  const total = [...minutes.values()].reduce((s, m) => s + m, 0);
  const changed = props.rows.filter((r) => r.allocationId && minutes.get(r.key) !== original.get(r.key));

  const rows: AllocationRow[] = props.rows.map((r) => {
    const m = minutes.get(r.key) ?? r.minutes;
    const edited = m !== original.get(r.key);
    return {
      ...r,
      minutes: m,
      percent: edited || changed.length > 0 ? Math.round((m / workingMinutes) * 1000) / 10 : r.percent,
      employeeAdjusted: r.employeeAdjusted || edited,
    };
  });

  // Scout's sentence still quotes the minutes Scout worked out, so say plainly that the bars no
  // longer match it. Scout's own words are left exactly as they were.
  const corrected = rows.some((r) => r.employeeAdjusted);

  const difference = total - workingMinutes;
  const blockedReason =
    difference === 0
      ? null
      : `The day adds up to ${formatMinutes(total)}. It needs to add up to ${formatMinutes(workingMinutes)} before you can send it, so ${difference > 0 ? `take off ${formatMinutes(difference)}` : `add ${formatMinutes(-difference)}`}.`;

  async function submit() {
    setSending(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/check-in/${encodeURIComponent(checkInId)}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adjustments: changed.map((r) => ({ allocation_id: r.allocationId, minutes: minutes.get(r.key) })) }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setProblem(data.message ?? 'Your day could not be sent just now. Your corrections are safe.');
        return;
      }
      setStatus('submitted');
    } catch {
      setProblem('Your day could not be sent just now. Your corrections are safe.');
    } finally {
      setSending(false);
    }
  }

  const words = statusInWords(status, managerFirstName, audience === 'self');

  return (
    <div className="space-y-6">
      {words && (
        <p role="status" className="rounded-lg border-2 border-accent bg-white px-6 py-4 text-2xl font-semibold text-accent">
          {words}
        </p>
      )}
      {status === 'returned' && managerComment && (
        <p className="rounded-lg bg-note px-6 py-4 text-lg">
          {managerFirstName} returned this day: {managerComment}
        </p>
      )}
      {summaryText && <p className="max-w-4xl text-xl leading-relaxed">{summaryText}</p>}

      {/* Kept at a steady height so nothing on the page moves the moment a correction is made. */}
      <div aria-live="polite" className={readOnly ? undefined : 'min-h-8'}>
        {corrected && <p className="text-lg font-medium text-accent">You have corrected this day. The bars show your numbers.</p>}
      </div>

      {!readOnly && (
        <p className="text-lg text-muted">
          If something is not right, correct it in steps of 15 minutes. The day must still add up to {formatMinutes(workingMinutes)}.
        </p>
      )}

      <AllocationBars
        rows={rows}
        periodLabel={periodLabel}
        audience={audience}
        editable={!readOnly}
        onMinutesChange={(key, m) => setMinutes((prev) => new Map(prev).set(key, m))}
      />

      {!readOnly && (
        <div className={`sticky bottom-0 flex flex-wrap items-center justify-between gap-4 ${card} shadow-[0_-6px_16px_rgba(15,23,42,0.10)]`}>
          <div className="space-y-1">
            <p className="text-xl font-semibold tabular-nums">
              {formatMinutes(total)} of {formatMinutes(workingMinutes)}
            </p>
            {changed.length > 0 && (
              <button type="button" onClick={() => setMinutes(new Map(original))} className={btnLink}>
                Put it back
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {blockedReason && <p className={`max-w-md ${warning}`}>{blockedReason}</p>}
            {sending && !blockedReason && (
              <p aria-live="polite" className={`max-w-md animate-pulse ${waitingWords}`}>
                Scout is saving your corrections and putting the day in front of {managerFirstName}.
              </p>
            )}
            <button type="button" onClick={() => void submit()} disabled={blockedReason !== null || sending} className={btnPrimary}>
              {sending ? 'Sending' : 'Submit'}
            </button>
          </div>
        </div>
      )}
      {problem && (
        <div role="alert" className={errorPanel}>
          <p>{problem}</p>
          <button type="button" onClick={() => void submit()} disabled={sending} className={btnPrimary}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
