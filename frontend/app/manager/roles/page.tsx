import { listRolesWithTopics } from "@/lib/data";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

export default async function RolesPage() {
  await requireManager();
  const roles = await orRefuse(listRolesWithTopics());

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold">Roles and expected time</h1>
      <p className="text-xl text-muted">Scout has read {roles.length} role documents and proposed how each role should spend its time.</p>
      <p className="text-lg text-muted">This screen is being built today.</p>
    </div>
  );
}
