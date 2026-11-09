import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, readJson, requireAdmin } from "@/lib/api";
import { createStation, listAdminStations } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json({ stations: listAdminStations() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const body = await readJson<{ code?: string; name?: string; active?: boolean }>(req);
    const station = createStation(admin, {
      code: String(body.code || ""),
      name: String(body.name || ""),
      active: body.active !== false,
    });
    return json({ station }, 201);
  });
}

export const dynamic = "force-dynamic";
