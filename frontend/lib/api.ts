// For route handlers: turns errors from lib/data.ts into plain JSON replies the screens can show.
import 'server-only';

import { AccessDenied, InvalidRequest } from './data';

export function errorResponse(error: unknown): Response {
  if (error instanceof AccessDenied) {
    return Response.json({ ok: false, message: error.message }, { status: error.signedOut ? 401 : 403 });
  }
  if (error instanceof InvalidRequest) {
    return Response.json({ ok: false, message: error.message }, { status: 400 });
  }
  console.error(error);
  return Response.json({ ok: false, message: 'Scout could not do that just now. Please try again.' }, { status: 502 });
}

/** Reads a JSON body, or null if it is missing or not JSON. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
