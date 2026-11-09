import { NextRequest } from "next/server";
import { STATION_CSV_TEMPLATE } from "@/lib/spreadsheet";
import { handle, requireAdmin } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return new Response(STATION_CSV_TEMPLATE, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="metro-assist-station-template.csv"',
      },
    });
  });
}
