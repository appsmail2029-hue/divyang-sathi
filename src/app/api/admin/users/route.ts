import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, readJson, requireAdmin } from "@/lib/api";
import { createUser, listAdminStations, listUsers } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json({ users: listUsers(), stations: listAdminStations() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const body = await readJson<{
      username?: string;
      displayName?: string;
      role?: "admin" | "station";
      stationId?: number | null;
      password?: string;
    }>(req);
    const result = createUser(admin, {
      username: String(body.username || ""),
      displayName: String(body.displayName || ""),
      role: body.role === "admin" ? "admin" : "station",
      stationId: body.stationId != null ? Number(body.stationId) : null,
      password: String(body.password || ""),
    });
    return json({ user: result }, 201);
  });
}

export const dynamic = "force-dynamic";
