// Asks Scout to review the approved history and suggest workflows. Body: { period_start, period_end }. Managers only.
import { errorResponse, readJson } from "@/lib/api";
import { listCandidates, reviewHistory } from "@/lib/data";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const body = await readJson(request);
  const start = body?.period_start;
  const end = body?.period_end;
  if (typeof start !== "string" || typeof end !== "string" || !DATE.test(start) || !DATE.test(end) || start > end) {
    return Response.json({ ok: false, message: "Please give the period to review as two dates." }, { status: 400 });
  }
  try {
    const reply = await reviewHistory(start, end);
    const candidates = await listCandidates();
    return Response.json({ ok: true, candidates_created: reply.candidates_created, candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
