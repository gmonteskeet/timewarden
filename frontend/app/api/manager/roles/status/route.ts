// When Scout last read the role documents, for polling after "Read the role documents again". Managers only.
import { errorResponse } from "@/lib/api";
import { getRolesReadStatus } from "@/lib/data";

export async function GET() {
  try {
    return Response.json({ ok: true, ...(await getRolesReadStatus()) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
