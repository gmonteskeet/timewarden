// Turns day allocations (one day, a week or a longer period) into rows for AllocationBars.
// Pure functions, safe on the server and in the browser.

import type { DayAllocation, Topic } from './contract';

export interface AllocationRow {
  /** Stable key: the topic id for in role rows, the label for outside role rows. */
  key: string;
  label: string;
  inRole: boolean;
  sortOrder: number;
  /** The role's expected long term share, or null for work outside the role. */
  expectedPercent: number | null;
  minutes: number;
  percent: number;
  evidence: string[];
  employeeAdjusted: boolean;
  /** Set for a single day, so a correction can name the allocation. */
  allocationId?: string;
}

/**
 * Every topic of the role gets a row, even with no time, so the layout never changes.
 * Outside role work is grouped by label. Percent is the share of all minutes given.
 */
export function rowsFromAllocations(topics: Topic[], allocations: DayAllocation[]): AllocationRow[] {
  const total = allocations.reduce((s, a) => s + a.minutes, 0);
  const pct = (m: number) => (total === 0 ? 0 : Math.round((m / total) * 1000) / 10);
  const single = new Set(allocations.map((a) => a.check_in_id)).size === 1;

  const inRole: AllocationRow[] = [...topics]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => {
      const mine = allocations.filter((a) => a.topic_id === t.id);
      const minutes = mine.reduce((s, a) => s + a.minutes, 0);
      return {
        key: t.id,
        label: t.name,
        inRole: true,
        sortOrder: t.sort_order,
        expectedPercent: t.expected_percent,
        minutes,
        percent: single && mine.length === 1 ? mine[0].percent : pct(minutes),
        evidence: mine.map((a) => a.evidence).filter(Boolean),
        employeeAdjusted: mine.some((a) => a.employee_adjusted),
        allocationId: single && mine.length === 1 ? mine[0].id : undefined,
      };
    });

  const outsideLabels = [...new Set(allocations.filter((a) => a.topic_id === null).map((a) => a.label))];
  const outside: AllocationRow[] = outsideLabels.map((label, i) => {
    const mine = allocations.filter((a) => a.topic_id === null && a.label === label);
    const minutes = mine.reduce((s, a) => s + a.minutes, 0);
    return {
      key: `outside:${label}`,
      label,
      inRole: false,
      sortOrder: 1000 + i,
      expectedPercent: null,
      minutes,
      percent: single && mine.length === 1 ? mine[0].percent : pct(minutes),
      evidence: [...new Set(mine.map((a) => a.evidence).filter(Boolean))].slice(0, 5),
      employeeAdjusted: mine.some((a) => a.employee_adjusted),
      allocationId: single && mine.length === 1 ? mine[0].id : undefined,
    };
  });

  return [...inRole, ...outside];
}

/** "2 hours 30 minutes" style, for people reading the screen. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 0 ? '' : h === 1 ? '1 hour' : `${h} hours`;
  const mins = m === 0 ? '' : `${m} min`;
  return [hours, mins].filter(Boolean).join(' ') || '0 min';
}
