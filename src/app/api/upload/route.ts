import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { assertSameOrigin, handle, HttpError, json, requireStaff } from "@/lib/api";
import { UPLOAD_DIR, audit } from "@/lib/db";
import { randomToken } from "@/lib/crypto";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = requireStaff(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") throw new HttpError("Choose an image to upload.", 400);
    if (!(file instanceof File)) throw new HttpError("Invalid upload.", 400);
    if (!ALLOWED[file.type]) throw new HttpError("Only JPG, PNG, WEBP or GIF images are allowed.", 400);
    if (file.size > 5 * 1024 * 1024) throw new HttpError("Image must be 5 MB or smaller.", 400);
    const filename = `${Date.now()}-${randomToken(6)}.${ALLOWED[file.type]}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    audit({
      actorUserId: user.id,
      actorName: user.displayName,
      stationId: user.stationId,
      action: "IMAGE_UPLOADED",
      entity: "upload",
      entityId: filename,
      details: `${file.type}, ${Math.round(file.size / 1024)} KB`,
    });
    return json({ url: `/api/uploads/${filename}` }, 201);
  });
}
