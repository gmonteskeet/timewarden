// The manager decides on a suggestion. Body: { decision: "approved" | "rejected", comment }. Managers only.
import { errorResponse, readJson } from "@/lib/api";
import { decideOnCandidate } from "@/lib/data";

export async function POST(request: Request, ctx: RouteContext<"/api/manager/candidates/[id]/decide">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  const decision = body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return Response.json({ ok: false, message: "Please choose approve or not now." }, { status: 400 });
  }
  try {
    const reply = await decideOnCandidate(id, decision, typeof body?.comment === "string" ? body.comment : null);
    return Response.json({ ok: true, make_scenario_url: reply.make_scenario_url ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
