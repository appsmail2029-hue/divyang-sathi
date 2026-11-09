import { NextRequest } from "next/server";
import fs from "node:fs";
import { handle, requireAdmin } from "@/lib/api";
import { exportDatabaseJson } from "@/lib/admin";
import { DB_PATH, db } from "@/lib/db";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    const format = req.nextUrl.searchParams.get("format") || "json";
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "sqlite") {
      try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        /* non-fatal */
      }
      const buffer = fs.readFileSync(DB_PATH);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="metro-assist-${stamp}.db"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const payload = exportDatabaseJson();
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="metro-assist-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

export const dynamic = "force-dynamic";
