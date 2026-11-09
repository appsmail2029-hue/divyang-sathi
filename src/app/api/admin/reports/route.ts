import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { buildReport } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    const raw = req.nextUrl.searchParams.get("range");
    const range = raw === "weekly" || raw === "monthly" ? raw : "daily";
    return json(buildReport(range));
  });
}

export const dynamic = "force-dynamic";
