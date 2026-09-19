'use client';

// The one standard summary, used everywhere: expected share against actual share per topic,
// in role topics first, then work outside the role. Same colours, order and layout every time.
// Every bar prints its number, so nothing depends on colour alone.

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
    <div className="flex items-center gap-3">
      <div className="h-5 flex-1 rounded bg-track">
        <div className={`h-5 rounded ${colour}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-72 shrink-0 text-lg tabular-nums text-ink">{text}</span>
    </div>
  );
}

function Row({ row, editable, step, onMinutesChange }: { row: AllocationRow; editable: boolean; step: number; onMinutesChange?: (key: string, minutes: number) => void }) {
  return (
    <li className="border-t border-line py-4 first:border-t-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xl font-semibold text-ink">
          {row.label}
          {row.employeeAdjusted && <span className="ml-3 rounded bg-note px-2 py-0.5 text-sm font-medium text-ink">Corrected by the employee</span>}
        </p>
        {editable && onMinutesChange && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-line px-3 py-1 text-lg hover:bg-track disabled:opacity-40"
              onClick={() => onMinutesChange(row.key, Math.max(0, row.minutes - step))}
              disabled={row.minutes === 0}
              aria-label={`Take ${step} minutes off ${row.label}`}
            >
              − {step} min
            </button>
            <button
              type="button"
              className="rounded border border-line px-3 py-1 text-lg hover:bg-track"
              onClick={() => onMinutesChange(row.key, row.minutes + step)}
              aria-label={`Add ${step} minutes to ${row.label}`}
            >
              + {step} min
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {row.expectedPercent !== null && <Bar percent={row.expectedPercent} tone="expected" text={`Expected ${row.expectedPercent}%`} />}
        <Bar
          percent={row.percent}
          tone={row.inRole ? 'actual' : 'outside'}
          text={`Actual ${row.percent}%, ${formatMinutes(row.minutes)}`}
        />
      </div>
      {row.evidence.length > 0 && (
        <details className="mt-2 text-base text-muted">
          <summary className="cursor-pointer select-none">What Scout saw</summary>
          <ul className="mt-1 list-disc pl-6">
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
    <section aria-label={`Expected against actual time, ${periodLabel}`} className="rounded-lg border border-line bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">Expected against actual: {periodLabel}</h2>
        <div className="flex flex-wrap gap-5 text-base text-muted">
          <span className="flex items-center gap-2"><span className="inline-block h-4 w-8 rounded bg-expected" />Expected long term share</span>
          <span className="flex items-center gap-2"><span className="inline-block h-4 w-8 rounded bg-actual" />Actual share</span>
          <span className="flex items-center gap-2"><span className="inline-block h-4 w-8 rounded bg-outside" />Outside the role</span>
        </div>
      </div>

      <ul>
        {inRole.map((row) => (
          <Row key={row.key} row={row} editable={editable} step={stepMinutes} onMinutesChange={onMinutesChange} />
        ))}
      </ul>

      {outside.length > 0 && (
        <>
          <h3 className="mt-6 border-t-2 border-outside pt-4 text-xl font-semibold text-ink">
            {audience === 'manager' ? 'Outside the role' : 'Outside your role'}
          </h3>
          <ul>
            {outside.map((row) => (
              <Row key={row.key} row={row} editable={editable} step={stepMinutes} onMinutesChange={onMinutesChange} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
