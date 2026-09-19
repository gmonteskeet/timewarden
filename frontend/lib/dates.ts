// Dates as people read them, in British English. Days are stored as YYYY-MM-DD.

/** "Friday 18 September" */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
