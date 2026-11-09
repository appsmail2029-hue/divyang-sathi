import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { verifyRoutes } from "@/lib/admin";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json(verifyRoutes());
  });
}

export const dynamic = "force-dynamic";
