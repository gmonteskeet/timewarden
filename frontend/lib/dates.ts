// Dates as people read them, in British English. Days are stored as YYYY-MM-DD.
// Every function here copes with an empty, missing or unreadable value: it returns null or a plain
// fallback and never throws, because live data can leave any of these columns empty.

type MaybeText = string | null | undefined;

/** A YYYY-MM-DD day as a Date at midday UTC, or null. */
function parseDay(day: MaybeText): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return null;
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A timestamp as a Date, or null. */
function parseTime(iso: MaybeText): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const utc = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" });
const madrid = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/Madrid" });

/** "Friday 18 September", or "this day" when the day is missing. */
export function dayLabel(day: MaybeText): string {
  const d = parseDay(day);
  return d ? utc({ weekday: "long", day: "numeric", month: "long" }).format(d) : "this day";
}

/** "Saturday 19 September at 16:05", in Madrid time, or null when there is no usable time. */
export function timeLabel(iso: MaybeText): string | null {
  const d = parseTime(iso);
  if (!d) return null;
  const day = madrid({ weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = madrid({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day} at ${time}`;
}

/** "31 August to 18 September", with plain wording when either end is missing. */
export function periodLabel(start: MaybeText, end: MaybeText): string {
  const f = utc({ day: "numeric", month: "long" });
  const a = parseDay(start);
  const b = parseDay(end);
  if (a && b) return `${f.format(a)} to ${f.format(b)}`;
  if (a) return `from ${f.format(a)}`;
  if (b) return `up to ${f.format(b)}`;
  return "the period";
}

/** "Approved by Tomas Berg on Saturday 19 September at 16:05". Leaves out what is missing. */
export function approvedText(name: MaybeText, at: MaybeText): string {
  const when = timeLabel(at);
  return `Approved by ${name?.trim() || "the manager"}${when ? ` on ${when}` : ""}`;
}

/** "Monday 14 to Friday 18 September", for a Monday to Friday week, or "this week". */
export function weekLabel(monday: MaybeText, friday: MaybeText): string {
  const a = parseDay(monday);
  const b = parseDay(friday);
  if (!a || !b) return "this week";
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const start = utc(sameMonth ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" }).format(a);
  return `${start} to ${utc({ weekday: "long", day: "numeric", month: "long" }).format(b)}`;
}
