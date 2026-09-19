// The manager approves a role's split. Body: { topics: [{ topic_id, expected_percent }] }. Managers only.
import { errorResponse, readJson } from "@/lib/api";
import { approveRoleSplit, listRolesWithTopics } from "@/lib/data";

export async function POST(request: Request, ctx: RouteContext<"/api/manager/roles/[id]/approve">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  if (!body || !Array.isArray(body.topics)) {
    return Response.json({ ok: false, message: "Please send the split as a list of topics." }, { status: 400 });
  }
  const topics = body.topics.map((t: { topic_id?: unknown; expected_percent?: unknown }) => ({
    topic_id: typeof t?.topic_id === "string" ? t.topic_id : "",
    expected_percent: typeof t?.expected_percent === "number" ? t.expected_percent : Number.NaN,
  }));
  try {
    await approveRoleSplit(id, topics);
    const role = (await listRolesWithTopics()).find((r) => r.role.id === id);
    return Response.json({ ok: true, role });
  } catch (error) {
    return errorResponse(error);
  }
}
