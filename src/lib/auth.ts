import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { q1, exec, nowIso } from "./db";
import { randomToken, sha256, verifyPassword, hashPassword } from "./crypto";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "metro_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface SessionRow {
  id: number;
  session_id: number;
  username: string;
  display_name: string;
  role: "admin" | "station";
  station_id: number | null;
  station_name: string | null;
  station_code: string | null;
  station_active: number | null;
  expires_at: string;
  user_active: number;
}

export function authenticate(username: string, password: string): SessionUser | null {
  const row = q1<{
    id: number;
    username: string;
    password_hash: string;
    display_name: string;
    role: "admin" | "station";
    station_id: number | null;
    station_active: number | null;
    active: number;
    station_name: string | null;
    station_code: string | null;
  }>(
    `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.station_id, u.is_active AS active,
            s.is_active AS station_active, s.station_name, s.station_code
       FROM users u
       LEFT JOIN stations s ON s.id = u.station_id
      WHERE u.username = ?`,
    username.trim().toLowerCase()
  );
  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  if (row.role === "station" && (!row.station_active || row.station_id == null)) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    stationId: row.station_id,
    stationName: row.station_name,
    stationCode: row.station_code,
  };
}

export function issueSession(userId: number): { token: string; expiresAt: string } {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  exec(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
    sha256(token),
    userId,
    nowIso(),
    expiresAt,
    nowIso()
  );
  return { token, expiresAt };
}

export function sessionFromToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const row = q1<SessionRow>(
    `SELECT u.id AS id, s.id AS session_id, u.username, u.display_name, u.role, u.station_id, st.station_name, st.station_code,
            st.is_active AS station_active, s.expires_at, u.is_active AS user_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN stations st ON st.id = u.station_id
      WHERE s.token_hash = ?`,
    sha256(token)
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    exec("DELETE FROM sessions WHERE id = ?", row.session_id);
    return null;
  }
  if (!row.user_active) return null;
  if (row.role === "station" && (!row.station_active || row.station_id == null)) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    stationId: row.station_id,
    stationName: row.station_name,
    stationCode: row.station_code,
  };
}

export function userFromRequest(req: NextRequest): SessionUser | null {
  return sessionFromToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function getServerUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return sessionFromToken(store.get(SESSION_COOKIE)?.value);
}

export function revokeCurrentSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) exec("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
}

export function applySessionCookie(res: NextResponse, token: string, expiresAt: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function changePassword(userId: number, newPassword: string) {
  exec(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
    hashPassword(newPassword),
    nowIso(),
    userId
  );
  exec("DELETE FROM sessions WHERE user_id = ?", userId);
}
