import ApprovalsClient, { type DayCard, type WeekCard } from "@/components/ApprovalsClient";
import { rowsFromAllocations } from "@/lib/allocation-rows";
import { listDaysAwaitingApproval, listTeamWeeks } from "@/lib/data";
import { dayLabel, weekLabel } from "@/lib/dates";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

const firstName = (full: string) => full.split(" ")[0];

export default async function ApprovalsPage() {
  await requireManager();
  // Only submitted days come back from these two calls. Days not yet submitted never reach this page.
  const [waiting, weeks] = await Promise.all([orRefuse(listDaysAwaitingApproval()), orRefuse(listTeamWeeks())]);

  const days: DayCard[] = [...waiting]
    .sort((a, b) => a.person.full_name.localeCompare(b.person.full_name) || a.check_in.day.localeCompare(b.check_in.day))
    .map((v) => ({
      id: v.check_in.id,
      person_name: v.person.full_name,
      first_name: firstName(v.person.full_name),
      day_label: dayLabel(v.check_in.day),
      summary_text: v.check_in.summary_text,
      rows: rowsFromAllocations(v.topics, v.allocations),
    }));

  const weekCards: WeekCard[] = weeks.map((w) => ({
    key: `${w.person.id}-${w.week_start}`,
    person_name: w.person.full_name,
    first_name: firstName(w.person.full_name),
    week_label: weekLabel(w.week_start, w.week_end),
    rows: rowsFromAllocations(w.topics, w.allocations),
    submitted_ids: w.submitted_ids,
    approved_count: w.approved_count,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Days waiting for approval</h1>
        {days.length > 0 && (
          <p className="max-w-4xl text-xl text-muted">
            Each day here has been reviewed and submitted by the employee. Approve it, or return it with a comment saying what should change.
          </p>
        )}
      </header>
      <ApprovalsClient days={days} weeks={weekCards} />
    </div>
  );
}
