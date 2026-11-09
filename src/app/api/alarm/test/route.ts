import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, requireStaff } from "@/lib/api";
import { audit } from "@/lib/db";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    audit({
      actorUserId: user.id,
      actorName: user.displayName,
      stationId: user.stationId,
      action: "TEST_ALARM",
      entity: "station",
      entityId: String(user.stationId),
      details: "Test alarm triggered locally by station staff.",
    });
    return json({ ok: true, station: user.stationName });
  });
}
