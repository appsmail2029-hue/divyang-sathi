import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, readJson, requireStaff } from "@/lib/api";
import { exec } from "@/lib/db";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const body = await readJson<{ endpoint?: string }>(req);
    if (body.endpoint) {
      exec("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", body.endpoint, user.id);
    }
    return json({ ok: true });
  });
}
