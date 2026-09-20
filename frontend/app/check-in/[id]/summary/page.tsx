import Link from "next/link";
import { redirect } from "next/navigation";
import SummaryClient from "@/components/SummaryClient";
import { btnPrimary } from "@/components/ui";
import { rowsFromAllocations } from "@/lib/allocation-rows";
import { getCheckIn } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { orRefuse } from "@/lib/guard";
import { requireSession } from "@/lib/session";

export default async function SummaryPage({ params }: PageProps<"/check-in/[id]/summary">) {
  const session = await requireSession();
  const { id } = await params;
  const view = await orRefuse(getCheckIn(id));
  const own = view.person.id === session.person_id;
  const when = dayLabel(view.check_in.day);
  const status = view.check_in.status;

  if (own && (status === "invited" || status === "in_progress")) redirect(`/check-in/${encodeURIComponent(id)}`);

  const managerFirstName = view.manager?.full_name.split(" ")[0] ?? "your manager";
  const editable = own && (status === "summarised" || status === "returned");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">{own ? `Your last working day: ${when}` : `${view.person.full_name}: ${when}`}</h1>
        {own && (
          <p className="max-w-4xl rounded-lg bg-track px-5 py-4 text-lg">
            This is for finding work to automate, not for judging people. Your manager sees a day only after you submit it.
          </p>
        )}
      </header>

      {view.allocations.length === 0 ? (
        <div className="space-y-4">
          <p className="max-w-3xl text-xl text-muted">
            Scout has not written a summary for this day yet. The bars appear here, one per topic, as soon as the check in has finished.
          </p>
          {own && (
            <Link href={`/check-in/${encodeURIComponent(id)}`} className={btnPrimary}>
              Back to the check in
            </Link>
          )}
        </div>
      ) : (
        <SummaryClient
          checkInId={view.check_in.id}
          summaryText={view.check_in.summary_text}
          periodLabel={when}
          rows={rowsFromAllocations(view.topics, view.allocations)}
          workingMinutes={view.person.working_minutes_per_day}
          status={status}
          editable={editable}
          audience={own ? "self" : "manager"}
          managerFirstName={managerFirstName}
          managerComment={view.check_in.manager_comment}
        />
      )}
    </div>
  );
}
