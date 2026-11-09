import { handle, json, requireStaff } from "@/lib/api";
import { getDashboard } from "@/lib/repo";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = requireStaff(req);
    return json(getDashboard(user.stationId!));
  });
}

export const dynamic = "force-dynamic";
