import { NextRequest } from "next/server";
import { assertSameOrigin, handle, json, requireStaff } from "@/lib/api";
import { silenceRequestAlarms } from "@/lib/workflow";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const { code } = await params;
    return json(silenceRequestAlarms(user, code));
  });
}
