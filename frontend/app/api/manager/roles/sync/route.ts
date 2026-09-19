// Asks Scout to read the role documents again and propose splits. Managers only.
import { errorResponse } from "@/lib/api";
import { rereadRoleDocuments } from "@/lib/data";

export async function POST() {
  try {
    const reply = await rereadRoleDocuments();
    return Response.json({ ok: true, roles_read: reply.roles_read, topics_proposed: reply.topics_proposed });
  } catch (error) {
    return errorResponse(error);
  }
}
