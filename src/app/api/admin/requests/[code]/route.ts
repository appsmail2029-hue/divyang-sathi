import { NextRequest } from "next/server";
import { handle, HttpError, json, requireAdmin } from "@/lib/api";
import { getRequestByCode } from "@/lib/repo";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    requireAdmin(req);
    const { code } = await params;
    const request = getRequestByCode(code, true);
    if (!request) throw new HttpError("Request not found.", 404);
    return json({ request });
  });
}

export const dynamic = "force-dynamic";
