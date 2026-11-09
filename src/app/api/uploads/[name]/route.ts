import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { handle, HttpError, requireUser } from "@/lib/api";
import { UPLOAD_DIR } from "@/lib/db";

const CONTENT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  return handle(async () => {
    requireUser(req);
    const { name } = await params;
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
      throw new HttpError("Invalid file.", 400);
    }
    const filePath = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(filePath)) throw new HttpError("Image not found.", 404);
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const buffer = fs.readFileSync(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

export const dynamic = "force-dynamic";
