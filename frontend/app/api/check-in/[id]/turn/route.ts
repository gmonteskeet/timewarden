// One interview turn. Body: { employee_text: string | null }. Owner of the check in only.
import { errorResponse, readJson } from "@/lib/api";
import { sendInterviewAnswer } from "@/lib/data";

export async function POST(request: Request, ctx: RouteContext<"/api/check-in/[id]/turn">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  const text = body?.employee_text;
  if (!body || (text !== null && typeof text !== "string")) {
    return Response.json({ ok: false, message: "Please send an answer as text." }, { status: 400 });
  }
  try {
    const step = await sendInterviewAnswer(id, text);
    return Response.json({ ok: true, ...step });
  } catch (error) {
    return errorResponse(error);
  }
}
