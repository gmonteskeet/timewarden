// The status of a check in, for polling after the interview. Owner of the check in only.
import { errorResponse } from "@/lib/api";
import { getCheckInStatus } from "@/lib/data";

export async function GET(_request: Request, ctx: RouteContext<"/api/check-in/[id]/status">) {
  const { id } = await ctx.params;
  try {
    const status = await getCheckInStatus(id);
    return Response.json({ ok: true, status }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
