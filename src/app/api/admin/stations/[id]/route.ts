import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { updateStation } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const { id } = await params;
    const stationId = Number(id);
    if (!Number.isInteger(stationId) || stationId <= 0) throw new HttpError("Invalid station.", 400);
    const body = await readJson<{ code?: string; name?: string; active?: boolean }>(req);
    const station = updateStation(admin, stationId, {
      code: String(body.code || ""),
      name: String(body.name || ""),
      active: body.active !== false,
    });
    return json({ station });
  });
}
