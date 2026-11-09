import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireStaff } from "@/lib/api";
import { exec, nowIso } from "@/lib/db";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const body = await readJson<{
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    }>(req);
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new HttpError("Invalid push subscription.", 400);
    }
    if (!/^https:\/\//.test(sub.endpoint)) throw new HttpError("Invalid push endpoint.", 400);
    exec(
      `INSERT INTO push_subscriptions (user_id, station_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, station_id = excluded.station_id,
         p256dh = excluded.p256dh, auth = excluded.auth`,
      user.id,
      user.stationId!,
      sub.endpoint,
      sub.keys.p256dh,
      sub.keys.auth,
      nowIso()
    );
    return json({ ok: true }, 201);
  });
}
