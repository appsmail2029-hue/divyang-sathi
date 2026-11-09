import { NextRequest } from "next/server";
import { handle, json, requireStaff } from "@/lib/api";
import { listActiveStations } from "@/lib/repo";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireStaff(req);
    return json({ stations: listActiveStations() });
  });
}

export const dynamic = "force-dynamic";
