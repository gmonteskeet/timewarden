// Dates as people read them, in British English. Days are stored as YYYY-MM-DD.

/** "Friday 18 September" */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** "Saturday 19 September at 16:05", in Madrid time, for a timestamp. */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Madrid" }).format(d);
  return `${day} at ${time}`;
}

/** "31 August to 18 September" */
export function periodLabel(start: string, end: string): string {
  const f = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${f.format(new Date(`${start}T12:00:00Z`))} to ${f.format(new Date(`${end}T12:00:00Z`))}`;
}

/** "Approved by Tomas Berg on Saturday 19 September at 16:05" */
export function approvedText(name: string | null, at: string | null): string {
  return `Approved by ${name ?? "the manager"}${at ? ` on ${timeLabel(at)}` : ""}`;
}

/** "Monday 14 to Friday 18 September", for a Monday to Friday week. */
export function weekLabel(monday: string, friday: string): string {
  const day = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const sameMonth = monday.slice(0, 7) === friday.slice(0, 7);
  const start = day(monday, sameMonth ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" });
  return `${start} to ${day(friday, { weekday: "long", day: "numeric", month: "long" })}`;
}
