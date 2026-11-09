import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { adminListRequests } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const stationIdRaw = sp.get("stationId");
    const requests = adminListRequests({
      status: sp.get("status") || undefined,
      type: sp.get("type") || undefined,
      stationId: stationIdRaw ? Number(stationIdRaw) : undefined,
      search: sp.get("search") || undefined,
    });
    return json({ requests });
  });
}

export const dynamic = "force-dynamic";
