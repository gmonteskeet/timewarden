// "Reset the demo" on the home page: clears the demo progress and returns home.
import { NextResponse, type NextRequest } from "next/server";
import { resetDemo } from "@/lib/data";

export async function POST(request: NextRequest) {
  // Clearing the cookie can fail. The person still goes home either way, as they would
  // if it had worked, rather than landing on a crash page.
  try {
    await resetDemo();
  } catch (error) {
    console.error("[demo reset] Clearing the demo progress failed:", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
