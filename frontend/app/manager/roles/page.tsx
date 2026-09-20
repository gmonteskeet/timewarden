import RolesClient, { type RoleCardData } from "@/components/RolesClient";
import { canRereadRoleDocuments, listRolesWithTopics } from "@/lib/data";
import { approvedText, timeLabel } from "@/lib/dates";
import { orRefuse } from "@/lib/guard";
import { requireManager } from "@/lib/session";

// The order the demo walks through: the main character's role first, the manager's own role last.
const ROLE_ORDER = ["Senior Client Consultant", "Consultant", "Business Analyst", "Head of Client Delivery"];
const position = (title: string) => (ROLE_ORDER.includes(title) ? ROLE_ORDER.indexOf(title) : ROLE_ORDER.length);

export default async function RolesPage() {
  await requireManager();
  const roles = await orRefuse(listRolesWithTopics());

  const cards: RoleCardData[] = [...roles]
    .sort((a, b) => position(a.role.title) - position(b.role.title))
    .map(({ role, topics, approved_by }) => ({
      id: role.id,
      title: role.title,
      document_name: role.document_name,
      document_url: role.document_url,
      read_label: timeLabel(role.source_read_at),
      approved_label: role.split_status === "approved" ? approvedText(approved_by?.full_name ?? null, role.split_approved_at) : null,
      topics: topics.map((t) => ({ id: t.id, name: t.name, reasoning: t.reasoning, expected: t.expected_percent, proposed: t.proposed_percent })),
    }));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Roles and expected time</h1>
        <p className="max-w-4xl text-xl text-muted">
          Scout reads each role&apos;s document and proposes how that role&apos;s time should divide across its main topics. You have the last word: adjust any number, then approve.
        </p>
      </header>
      <RolesClient roles={cards} canReread={canRereadRoleDocuments()} />
    </div>
  );
}
