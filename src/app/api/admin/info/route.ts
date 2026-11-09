import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { q } from "@/lib/db";

interface AdminInfoRow {
  info_code: string;
  category: string;
  description: string;
  origin_name: string;
  image_url: string | null;
  status: "OPEN" | "CLOSED";
  created_at: string;
  closed_at: string | null;
  creator_name: string | null;
  ack_count: number;
  ack_names: string | null;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    const rows = q<AdminInfoRow>(
      `SELECT i.info_code, i.category, i.description, i.image_url, i.status, i.created_at, i.closed_at,
              s.station_name AS origin_name, u.display_name AS creator_name,
              (SELECT COUNT(*) FROM information_acknowledgements a WHERE a.info_code = i.info_code) AS ack_count,
              (SELECT GROUP_CONCAT(s2.station_name, ', ')
                 FROM information_acknowledgements a2 JOIN stations s2 ON s2.id = a2.station_id
                WHERE a2.info_code = i.info_code) AS ack_names
         FROM other_information i
         JOIN stations s ON s.id = i.origin_station_id
         LEFT JOIN users u ON u.id = i.created_by
        ORDER BY i.created_at DESC LIMIT 200`
    );
    return json({
      notices: rows.map((r) => ({
        infoCode: r.info_code,
        category: r.category,
        description: r.description,
        originStation: r.origin_name,
        imageUrl: r.image_url,
        status: r.status,
        createdAt: r.created_at,
        closedAt: r.closed_at,
        createdBy: r.creator_name || "Station staff",
        acknowledgedStations: Number(r.ack_count || 0),
        acknowledgedStationNames: r.ack_names ? r.ack_names.split(", ") : [],
      })),
    });
  });
}

export const dynamic = "force-dynamic";
