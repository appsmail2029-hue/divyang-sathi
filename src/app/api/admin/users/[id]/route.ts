import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { updateUser } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError("Invalid user.", 400);
    const body = await readJson<{
      displayName?: string;
      role?: "admin" | "station";
      stationId?: number | null;
      active?: boolean;
    }>(req);
    const result = updateUser(admin, userId, {
      displayName: String(body.displayName || ""),
      role: body.role === "admin" ? "admin" : "station",
      stationId: body.stationId != null ? Number(body.stationId) : null,
      active: body.active !== false,
    });
    return json({ user: result });
  });
}
