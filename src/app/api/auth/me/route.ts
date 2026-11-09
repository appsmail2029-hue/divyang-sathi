import { NextRequest } from "next/server";
import {
  clearSessionCookie,
  getServerUser,
  revokeCurrentSession,
  userFromRequest,
} from "@/lib/auth";
import { audit } from "@/lib/db";
import { getSettings } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export async function GET() {
  return handle(async () => {
    const user = await getServerUser();
    const settings = getSettings();
    return json({
      user,
      settings,
      serverTime: new Date().toISOString(),
      push: { configured: isPushConfigured(), publicKey: user?.role === "station" ? getVapidPublicKey() : "" },
    });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const user = userFromRequest(req);
    revokeCurrentSession(req);
    if (user) {
      audit({
        actorUserId: user.id,
        actorName: user.displayName,
        stationId: user.stationId,
        action: "LOGOUT",
        entity: user.role,
        entityId: String(user.id),
      });
    }
    const res = json({ ok: true });
    clearSessionCookie(res);
    return res;
  });
}
