import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, readJson, requireStaff } from "@/lib/api";
import { createAssistanceRequest } from "@/lib/workflow";
import type { AssistanceType, Direction } from "@/lib/types";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const body = await readJson<{
      assistanceType: AssistanceType;
      destinationStationId: number;
      passengerCount: number;
      trainNumber: string;
      trainSet: string;
      direction: Direction;
    }>(req);
    const request = createAssistanceRequest(user, {
      assistanceType: body.assistanceType,
      destinationStationId: Number(body.destinationStationId),
      passengerCount: Number(body.passengerCount),
      trainNumber: String(body.trainNumber || "").trim(),
      trainSet: String(body.trainSet || "").trim(),
      direction: body.direction,
    });
    return json({ request }, 201);
  });
}
