import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireStaff } from "@/lib/api";
import { markNotification } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const { id } = await params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      throw new HttpError("Invalid notification.", 400);
    }
    const body = await readJson<{ action?: string }>(req);
    const action = body.action === "silence" ? "silence" : "read";
    const notification = markNotification(notificationId, user.stationId!, action, user.id);
    if (!notification) throw new HttpError("Notification not found.", 404);
    return json({ notification });
  });
}
