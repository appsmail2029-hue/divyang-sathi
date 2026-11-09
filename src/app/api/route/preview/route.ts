import { NextRequest } from "next/server";
import { handle, HttpError, json, requireStaff } from "@/lib/api";
import { buildJourney, RouteError } from "@/lib/route";
import { getSettings } from "@/lib/db";
import type { Direction } from "@/lib/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = requireStaff(req);
    const sp = req.nextUrl.searchParams;
    const direction = sp.get("direction");
    const destination = Number(sp.get("to"));
    if (direction !== "+" && direction !== "-") throw new HttpError("Choose a circular direction.", 400);
    if (!Number.isInteger(destination) || destination <= 0) throw new HttpError("Choose a destination.", 400);
    try {
      const journey = buildJourney(user.stationId!, destination, direction as Direction);
      const settings = getSettings();
      return json({
        journey: journey.stations,
        distance: journey.distance,
        etaMinutes: journey.distance * Math.round((settings.secondsPerStation / 60) * 10) / 10,
      });
    } catch (error) {
      throw new HttpError(error instanceof RouteError ? error.message : "Route not configured.", 400);
    }
  });
}

export const dynamic = "force-dynamic";
