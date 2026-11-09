import { NextRequest } from "next/server";
import { handle, HttpError, json, requireUser } from "@/lib/api";
import { getRequestByCode, getRequestRow } from "@/lib/repo";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const user = requireUser(req);
    const { code } = await params;
    const row = getRequestRow(code);
    if (!row) throw new HttpError("Request not found.", 404);
    if (
      user.role !== "admin" &&
      user.stationId !== row.boarding_station_id &&
      user.stationId !== row.destination_station_id
    ) {
      throw new HttpError("You are not permitted to view this request.", 403);
    }
    return json({ request: getRequestByCode(code, true) });
  });
}

export const dynamic = "force-dynamic";
