import AllocationBars from "@/components/AllocationBars";
import SuggestionsClient from "@/components/SuggestionsClient";
import { rowsForTeam } from "@/lib/allocation-rows";
import { getCurrentPerson, getTeamHistory, listCandidates, reviewPeriod } from "@/lib/data";
import { periodLabel } from "@/lib/dates";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

export default async function SuggestionsPage() {
  await requireManager();
  const { period_start, period_end } = await reviewPeriod();
  const [history, candidates, me] = await Promise.all([orRefuse(getTeamHistory(period_start, period_end)), orRefuse(listCandidates()), getCurrentPerson()]);

  const members = history.members.filter((m) => m.approved_days > 0);
  const dayCounts = [...new Set(members.map((m) => m.approved_days))];
  const totalDays = members.reduce((s, m) => s + m.approved_days, 0);
  const reviewingText =
    dayCounts.length === 1
      ? `Scout is reviewing ${dayCounts[0]} approved days for each of ${members.length} people`
      : `Scout is reviewing ${totalDays} approved days from ${members.length} people`;
  const managerFirstName = me?.person.full_name.split(" ")[0] ?? "the manager";
  const rows = rowsForTeam(members.map((m) => ({ name: m.person.full_name, topics: m.topics, allocations: m.allocations })));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Suggested workflows</h1>
        <p className="text-lg text-muted">
          Built from days that employees reviewed and {managerFirstName} approved. Employees corrected {history.corrected_rows} row{history.corrected_rows === 1 ? "" : "s"}.
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-xl">This is where the team&apos;s approved time went over the last three weeks.</p>
        <AllocationBars rows={rows} periodLabel={periodLabel(period_start, period_end)} audience="manager" />
      </section>

      <SuggestionsClient initialCandidates={candidates} periodStart={period_start} periodEnd={period_end} reviewingText={reviewingText} />
    </div>
  );
}
