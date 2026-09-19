// "Reset the demo" on the home page: clears the demo progress and returns home.
import { NextResponse, type NextRequest } from "next/server";
import { resetDemo } from "@/lib/data";

export async function POST(request: NextRequest) {
  await resetDemo();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
