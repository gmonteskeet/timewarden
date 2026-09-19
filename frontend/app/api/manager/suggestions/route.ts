// The current suggestions, for polling after "Review the last three weeks". ?since= is the moment
// the review started; complete says whether suggestions newer than that exist. Managers only.
import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { listCandidatesSince } from "@/lib/data";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since") ?? new Date(0).toISOString();
  try {
    return Response.json({ ok: true, ...(await listCandidatesSince(since)) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
