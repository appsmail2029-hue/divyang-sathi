import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { getRoutes, listAdminStations, saveRoute, verifyRoutes } from "@/lib/admin";
import type { Direction } from "@/lib/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json({
      routes: getRoutes(),
      verification: verifyRoutes(),
      stations: listAdminStations(),
    });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const body = await readJson<{ direction?: Direction; stationIds?: number[] }>(req);
    if (body.direction !== "+" && body.direction !== "-") {
      throw new HttpError("Choose + Circular or - Circular.", 400);
    }
    if (!Array.isArray(body.stationIds)) throw new HttpError("A station sequence is required.", 400);
    const stationIds = body.stationIds.map(Number);
    saveRoute(admin, body.direction, stationIds);
    return json({ routes: getRoutes(), verification: verifyRoutes() });
  });
}

export const dynamic = "force-dynamic";
