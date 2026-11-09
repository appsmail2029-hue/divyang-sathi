import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { resetUserPassword } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError("Invalid user.", 400);
    const body = await readJson<{ password?: string }>(req);
    return json(resetUserPassword(admin, userId, String(body.password || "")));
  });
}
