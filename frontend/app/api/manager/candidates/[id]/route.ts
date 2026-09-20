// One suggestion, for polling until its draft link appears. Managers only.
import { errorResponse } from "@/lib/api";
import { getCandidate } from "@/lib/data";

export async function GET(_request: Request, ctx: RouteContext<"/api/manager/candidates/[id]">) {
  const { id } = await ctx.params;
  try {
    const candidate = await getCandidate(id);
    return Response.json({ ok: true, candidate }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
