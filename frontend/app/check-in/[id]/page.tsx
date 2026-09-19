import { redirect } from "next/navigation";
import AllocationBars from "@/components/AllocationBars";
import { rowsFromAllocations } from "@/lib/allocation-rows";
import { getCheckIn, listMyCheckIns } from "@/lib/data";
import { orRefuse } from "@/lib/guard";
import { requireSession } from "@/lib/session";

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

export default async function CheckInPage({ params }: PageProps<"/check-in/[id]">) {
  const session = await requireSession();
  const { id } = await params;

  // "My check in" in the top bar points here: open the newest check in that is not yet approved.
  if (id === "current") {
    const mine = await orRefuse(listMyCheckIns());
    const open = mine.find((c) => c.status !== "approved") ?? mine[0];
    redirect(open ? `/check-in/${open.id}` : "/");
  }

  const view = await orRefuse(getCheckIn(id));
  const own = view.person.id === session.person_id;
  const when = dayLabel(view.check_in.day);
  const rows = rowsFromAllocations(view.topics, view.allocations);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">{own ? `Your last working day: ${when}` : `${view.person.full_name}: ${when}`}</h1>
        {own && (
          <p className="max-w-4xl rounded-lg bg-track px-5 py-4 text-lg">
            This is for finding work to automate, not for judging people. Your manager sees a day only after you submit it.
          </p>
        )}
        <p className="text-lg text-muted">This screen is being built today.</p>
      </header>

      {view.check_in.summary_text && <p className="max-w-4xl text-xl leading-relaxed">{view.check_in.summary_text}</p>}

      {view.allocations.length > 0 && <AllocationBars rows={rows} periodLabel={when} audience={own ? "self" : "manager"} />}
    </div>
  );
}
