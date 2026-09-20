import { redirect } from "next/navigation";
import InterviewClient from "@/components/InterviewClient";
import { demoDay, findMyCheckInForDay, getCheckIn, getSuggestedAnswer } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { orRefuse } from "@/lib/guard";
import { requireSession } from "@/lib/session";

export default async function CheckInPage({ params }: PageProps<"/check-in/[id]">) {
  const session = await requireSession();
  const { id } = await params;

  // "My check in" in the top bar points here: open the check in for the demo day, if one exists.
  if (id === "current") {
    const mine = await orRefuse(findMyCheckInForDay(await demoDay()));
    if (!mine) {
      return (
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold">My check in</h1>
          <p className="text-xl">There is no check in for you yet. It arrives with your morning email.</p>
        </div>
      );
    }
    redirect(`/check-in/${encodeURIComponent(mine.id)}`);
  }

  const view = await orRefuse(getCheckIn(id));
  const summaryPath = `/check-in/${encodeURIComponent(id)}/summary`;
  // Only the employee takes their own interview. Anyone else allowed to see the day sees the summary.
  if (view.person.id !== session.person_id) redirect(summaryPath);
  if (["summarised", "submitted", "approved", "returned"].includes(view.check_in.status)) redirect(summaryPath);

  const suggestion = await orRefuse(getSuggestedAnswer(id));
  const firstName = view.person.full_name.split(" ")[0];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Tell Scout about your last working day: {dayLabel(view.check_in.day)}</h1>
        <p className="max-w-4xl rounded-lg bg-track px-5 py-4 text-lg">
          This is for finding work to automate, not for judging people. Your manager sees a day only after you submit it.
        </p>
        <p className="text-lg text-muted">
          Hello {firstName}. Scout has your calendar and recorded calls for the day, and will ask a few short questions about what it cannot see.
        </p>
      </header>

      <InterviewClient
        checkInId={view.check_in.id}
        initialTurns={view.turns.map((t) => ({ turn_no: t.turn_no, speaker: t.speaker, text: t.text, kind: t.kind, evidence: t.evidence }))}
        initialSuggestion={suggestion}
      />
    </div>
  );
}
