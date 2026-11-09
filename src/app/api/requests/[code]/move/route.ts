import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireStaff } from "@/lib/api";
import { moveTrain } from "@/lib/workflow";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const { code } = await params;
    const body = await readJson<{ stationId?: number | string }>(req);
    const stationId = Number(body.stationId);
    if (!Number.isInteger(stationId) || stationId <= 0) {
      throw new HttpError("Select a valid station.", 400);
    }
    return json({ request: moveTrain(user, code, stationId) });
  });
}
