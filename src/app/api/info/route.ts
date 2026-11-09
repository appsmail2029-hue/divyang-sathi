import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, readJson, requireStaff } from "@/lib/api";
import { listNotices } from "@/lib/repo";
import { createInformation } from "@/lib/workflow";
import type { InfoCategory } from "@/lib/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = requireStaff(req);
    const includeClosed = req.nextUrl.searchParams.get("includeClosed") === "1";
    return json({ notices: listNotices(user.stationId!, includeClosed, 60) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const body = await readJson<{ category: InfoCategory; description: string; imageUrl?: string }>(req);
    const result = createInformation(user, {
      category: body.category,
      description: String(body.description || ""),
      imageUrl: body.imageUrl || null,
    });
    return json(result, 201);
  });
}

export const dynamic = "force-dynamic";
