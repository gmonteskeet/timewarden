// The manager approves or returns submitted days. Body: { check_in_ids, decision, comment }. Managers only.
import { errorResponse, readJson } from "@/lib/api";
import { decideOnDays } from "@/lib/data";

export async function POST(request: Request) {
  const body = await readJson(request);
  const ids = body?.check_in_ids;
  const decision = body?.decision;
  const comment = body?.comment;
  if (!body || !Array.isArray(ids) || ids.some((id) => typeof id !== "string") || (decision !== "approved" && decision !== "returned")) {
    return Response.json({ ok: false, message: "Please choose the days and whether to approve or return them." }, { status: 400 });
  }
  try {
    await decideOnDays(ids as string[], decision, typeof comment === "string" ? comment : null);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
