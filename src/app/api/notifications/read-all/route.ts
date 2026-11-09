import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, requireStaff } from "@/lib/api";
import { exec, nowIso } from "@/lib/db";
import { broadcast } from "@/lib/events";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    exec(
      `UPDATE notifications SET status = 'READ', read_at = ?, read_by = ?
        WHERE (station_id = ? OR station_id IS NULL) AND status = 'UNREAD'`,
      nowIso(),
      user.id,
      user.stationId!
    );
    broadcast({ type: "notification.updated" }, [user.stationId!]);
    return json({ ok: true });
  });
}
