'use client';

// The one standard summary, used everywhere: expected share against actual share per topic,
// in role topics first, then work outside the role. Same colours, order and layout every time.
// Every bar prints its number, so nothing depends on colour alone, and the number never wraps.

import { btnQuietSmall, card, focusRing } from '@/components/ui';
import { formatMinutes, type AllocationRow } from '@/lib/allocation-rows';

export interface AllocationBarsProps {
  rows: AllocationRow[];
  /** What "actual" covers, for example "Friday 18 September" or "31 August to 17 September". */
  periodLabel: string;
  /** "self" when people look at their own data, "manager" when a manager looks at someone else's. */
  audience?: 'self' | 'manager';
  /** Shows controls that change minutes in steps of stepMinutes and reports each change upwards. */
  editable?: boolean;
  stepMinutes?: number;
  onMinutesChange?: (key: string, minutes: number) => void;
}

function Bar({ percent, tone, text }: { percent: number; tone: 'expected' | 'actual' | 'outside'; text: string }) {
  const colour = tone === 'expected' ? 'bg-expected' : tone === 'actual' ? 'bg-actual' : 'bg-outside';
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="scout-bar-line">
      <div className="h-6 min-w-0 rounded-full bg-track">
        <div className={`scout-bar-fill h-6 rounded-full ${colour}`} style={{ width: `${width}%` }} />
      </div>
      <span className="whitespace-nowrap text-right text-lg tabular-nums text-ink">{text}</span>
    </div>
  );
}

function Row({ row, editable, step, audience, onMinutesChange }: { row: AllocationRow; editable: boolean; step: number; audience: 'self' | 'manager'; onMinutesChange?: (key: string, minutes: number) => void }) {
  const canEdit = editable && onMinutesChange && row.allocationId !== undefined;
  return (
    <li className="border-t border-line py-5 first:border-t-0">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-semibold text-ink">
          {row.label}
          {row.employeeAdjusted && (
            <span className="ml-3 inline-block rounded-full border border-accent/15 bg-accent-soft px-3 py-0.5 text-base font-medium text-accent">
              {audience === 'self' ? 'You corrected this' : 'Corrected by the employee'}
            </span>
          )}
        </p>
        {canEdit && (
          <div className="scout-stepper items-center">
            <button
              type="button"
              className={btnQuietSmall}
              onClick={() => onMinutesChange!(row.key, Math.max(0, row.minutes - step))}
              disabled={row.minutes === 0}
              aria-label={`Take ${step} minutes off ${row.label}`}
            >
              − {step} min
            </button>
            <button
              type="button"
              className={btnQuietSmall}
              onClick={() => onMinutesChange!(row.key, row.minutes + step)}
              aria-label={`Add ${step} minutes to ${row.label}`}
            >
              + {step} min
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {row.expectedPercent !== null && <Bar percent={row.expectedPercent} tone="expected" text={`Expected ${row.expectedPercent}%`} />}
        <Bar
          percent={row.percent}
          tone={row.inRole ? 'actual' : 'outside'}
          text={`Actual ${row.percent}%, ${formatMinutes(row.minutes)}`}
        />
      </div>
      {row.evidence.length > 0 && (
        <details className="mt-2 text-base text-muted">
          <summary className={`inline-block cursor-pointer select-none px-1 font-medium text-accent underline ${focusRing}`}>Why?</summary>
          <ul className="mt-1 list-disc pl-6" aria-label="What Scout saw">
            {row.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export default function AllocationBars({ rows, periodLabel, audience = 'self', editable = false, stepMinutes = 15, onMinutesChange }: AllocationBarsProps) {
  const inRole = rows.filter((r) => r.inRole).sort((a, b) => a.sortOrder - b.sortOrder);
  const outside = rows.filter((r) => !r.inRole).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section aria-label={`Expected against actual time, ${periodLabel}`} className={card}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">Expected against actual: {periodLabel}</h2>
        <div className="flex flex-wrap gap-5 text-base text-muted">
          <span className="flex items-center gap-2"><span className="inline-block h-3 w-7 rounded-full bg-expected" />Expected long term share</span>
          <span className="flex items-center gap-2"><span className="inline-block h-3 w-7 rounded-full bg-actual" />Actual share</span>
          <span className="flex items-center gap-2"><span className="inline-block h-3 w-7 rounded-full bg-outside" />Outside the role</span>
        </div>
      </div>

      <ul className="scout-role-rows">
        {inRole.map((row) => (
          <Row key={row.key} row={row} editable={editable} step={stepMinutes} audience={audience} onMinutesChange={onMinutesChange} />
        ))}
      </ul>

      {outside.length > 0 && (
        <div className="scout-outside">
          <h3 className="flex items-center gap-3 text-xl font-semibold text-warn">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 4.4a2 2 0 0 1 3.4 0l7.5 13A2 2 0 0 1 19.5 20h-15a2 2 0 0 1-1.7-2.6z" />
              <path d="M12 9v4m0 3h.01" />
            </svg>
            {audience === 'manager' ? 'Outside the role' : 'Outside your role'}
          </h3>
          <ul>
            {outside.map((row) => (
              <Row key={row.key} row={row} editable={editable} step={stepMinutes} audience={audience} onMinutesChange={onMinutesChange} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
