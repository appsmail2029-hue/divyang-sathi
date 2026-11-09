import { NextRequest } from "next/server";
import { requireUser, handle } from "@/lib/api";
import { createEventStream } from "@/lib/events";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = requireUser(req);
    return createEventStream(user);
  });
}

export const dynamic = "force-dynamic";
