// A personal link: /enter/<access_token>?next=/check-in/<check_in_id>
// Signs the person in with a signed, http only cookie, then sends them on.
import { NextResponse, type NextRequest } from "next/server";
import { findPersonByToken, landingPathFor } from "@/lib/data";
import { encodeSession, safeNextPath, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: NextRequest, ctx: RouteContext<"/enter/[token]">) {
  const { token } = await ctx.params;
  let person;
  let landing;
  try {
    person = await findPersonByToken(token);
    if (person) landing = await landingPathFor(person);
  } catch (error) {
    console.error("[enter] Sign in lookup failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.redirect(new URL("/?signin=unavailable", request.url), 303);
  }
  if (!person || !landing) {
    return NextResponse.redirect(new URL("/?signin=unknown", request.url), 303);
  }

  const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? landing;
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, encodeSession({ person_id: person.id, app_role: person.app_role }), sessionCookieOptions);
  return response;
}
