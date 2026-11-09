import { NextRequest } from "next/server";
import { authenticate, applySessionCookie, issueSession } from "@/lib/auth";
import { assertSameOrigin, handle, json, readJson, HttpError } from "@/lib/api";
import { q1, audit } from "@/lib/db";
import { clientKey, clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = await readJson<{
      portal?: string;
      username?: string;
      stationId?: number | string;
      password?: string;
    }>(req);
    const portal = body.portal === "admin" ? "admin" : "station";
    const password = typeof body.password === "string" ? body.password : "";

    let username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!username && body.stationId != null) {
      const stationId = Number(body.stationId);
      const row = q1<{ username: string }>(
        `SELECT u.username
           FROM users u JOIN stations s ON s.id = u.station_id
          WHERE u.station_id = ? AND u.role = 'station' AND u.is_active = 1 AND s.is_active = 1
          ORDER BY u.id LIMIT 1`,
        stationId
      );
      username = row?.username || "";
    }
    if (!username || !password) {
      throw new HttpError("Please enter your password and select a valid account.", 400);
    }

    const key = clientKey(req, `${portal}:${username}`);
    if (isRateLimited(key)) {
      throw new HttpError("Too many failed attempts. Please wait 10 minutes and try again.", 429);
    }

    const user = authenticate(username, password);
    if (!user || user.role !== portal) {
      recordFailure(key);
      audit({
        actorName: username || "unknown",
        action: "LOGIN_FAILED",
        entity: portal,
        entityId: username || null,
        details: portal === "admin" ? "Administrator sign-in failed." : "Station sign-in failed.",
      });
      throw new HttpError(
        portal === "admin" ? "Invalid administrator credentials." : "Invalid station or password.",
        401
      );
    }

    clearFailures(key);
    const { token, expiresAt } = issueSession(user.id);
    audit({
      actorUserId: user.id,
      actorName: user.displayName,
      stationId: user.stationId,
      action: "LOGIN",
      entity: portal,
      entityId: String(user.id),
      details: `${user.displayName} signed in.`,
    });

    const res = json({ user });
    applySessionCookie(res, token, expiresAt);
    return res;
  });
}
