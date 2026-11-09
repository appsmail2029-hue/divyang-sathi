import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { listAuditLogs } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 250, 500);
    return json({ logs: listAuditLogs(limit) });
  });
}

export const dynamic = "force-dynamic";
