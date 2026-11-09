import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, requireAdmin } from "@/lib/api";
import { importStations } from "@/lib/admin";
import { spreadsheetRows, validateStationRows } from "@/lib/spreadsheet";

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string" || !(file instanceof File)) {
      throw new HttpError("Choose a CSV or Excel file to import.", 400);
    }
    if (file.size > 5 * 1024 * 1024) throw new HttpError("Upload must be 5 MB or smaller.", 400);

    let rows: string[][];
    try {
      rows = spreadsheetRows(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (error) {
      throw new HttpError(error instanceof Error ? error.message : "Could not read the file.", 400);
    }
    const validation = validateStationRows(rows);
    if (validation.errors.length) {
      throw new HttpError("The station file has validation errors.", 400, validation.errors.slice(0, 30));
    }
    const result = importStations(admin, validation.rows);
    return json({ ...result, imported: validation.rows.length });
  });
}
