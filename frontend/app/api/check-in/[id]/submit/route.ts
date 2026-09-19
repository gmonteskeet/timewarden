// The employee submits their day. Body: { adjustments: [{ allocation_id, minutes }] }. Owner only.
import { errorResponse, readJson } from "@/lib/api";
import { submitCheckIn } from "@/lib/data";

export async function POST(request: Request, ctx: RouteContext<"/api/check-in/[id]/submit">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  const raw = body?.adjustments;
  if (!Array.isArray(raw)) {
    return Response.json({ ok: false, message: "Please send the corrections as a list." }, { status: 400 });
  }
  const adjustments = raw.map((a) => ({
    allocation_id: typeof a?.allocation_id === "string" ? a.allocation_id : "",
    minutes: typeof a?.minutes === "number" ? a.minutes : Number.NaN,
  }));
  try {
    await submitCheckIn(id, adjustments);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
