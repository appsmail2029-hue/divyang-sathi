import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { getAdminOverview } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json(getAdminOverview());
  });
}

export const dynamic = "force-dynamic";
