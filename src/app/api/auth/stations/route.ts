import { NextRequest } from "next/server";
import { applySessionCookie } from "@/lib/auth";
import { assertSameOrigin, handle, json } from "@/lib/api";
import { listLoginStations } from "@/lib/repo";

export async function GET() {
  return handle(async () => {
    return json({ stations: listLoginStations() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    return json({ stations: listLoginStations() });
  });
}

export const dynamic = "force-dynamic";
