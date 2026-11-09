import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, requireAdmin } from "@/lib/api";
import { closeInformation } from "@/lib/workflow";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const { code } = await params;
    return json(closeInformation(admin, code));
  });
}
