import { NextRequest } from "next/server";
import { handle, json, requireStaff } from "@/lib/api";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireStaff(req);
    return json({
      configured: isPushConfigured(),
      publicKey: getVapidPublicKey(),
    });
  });
}
