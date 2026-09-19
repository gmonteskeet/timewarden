import { listCandidates } from "@/lib/data";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

export default async function SuggestionsPage() {
  await requireManager();
  const candidates = await orRefuse(listCandidates());

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold">Suggested workflows</h1>
      <p className="text-xl text-muted">Scout has {candidates.length} suggestions from the team&apos;s approved days.</p>
      <p className="text-lg text-muted">This screen is being built today.</p>
    </div>
  );
}
