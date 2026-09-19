import { listDaysAwaitingApproval } from "@/lib/data";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

export default async function ApprovalsPage() {
  await requireManager();
  const days = await orRefuse(listDaysAwaitingApproval());

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold">Days waiting for approval</h1>
      <p className="text-xl text-muted">
        {days.length === 0
          ? "No submitted days are waiting for you."
          : days.length === 1
            ? "1 submitted day is waiting for you."
            : `${days.length} submitted days are waiting for you.`}
      </p>
      <p className="text-lg text-muted">This screen is being built today.</p>
    </div>
  );
}
