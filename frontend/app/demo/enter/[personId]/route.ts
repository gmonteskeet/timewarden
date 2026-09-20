// Demo sign in without putting a real access token in the page: the person is looked up on the
// server by id. Works only in fixtures mode or when the server setting DEMO_SIGN_IN is "true".
import { NextResponse, type NextRequest } from "next/server";
import { findPersonForDemoSignIn, landingPathFor } from "@/lib/data";
import { encodeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: NextRequest, ctx: RouteContext<"/demo/enter/[personId]">) {
  const { personId } = await ctx.params;
  let person;
  let landing;
  try {
    person = await findPersonForDemoSignIn(personId);
    if (person) landing = await landingPathFor(person);
  } catch (error) {
    console.error("[demo enter] Sign in lookup failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.redirect(new URL("/?signin=unavailable", request.url), 303);
  }
  if (!person || !landing) {
    return NextResponse.redirect(new URL("/?signin=unknown", request.url), 303);
  }
  const response = NextResponse.redirect(new URL(landing, request.url), 303);
  response.cookies.set(SESSION_COOKIE, encodeSession({ person_id: person.id, app_role: person.app_role }), sessionCookieOptions);
  return response;
}
