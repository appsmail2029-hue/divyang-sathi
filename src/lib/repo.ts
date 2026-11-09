import { q, q1, nowIso, getSettings } from "./db";
import { journeyForStoredRequest, offsetForStation } from "./route";
import type {
  Acknowledgement,
  AssistanceRequest,
  AssistanceType,
  DashboardData,
  Direction,
  InfoCategory,
  JourneyStation,
  NotificationItem,
  OtherInfo,
  RequestStatus,
  StationOption,
  TrainMovement,
} from "./types";
import { notificationRowsForStation } from "./notify";

export interface RequestRow {
  request_code: string;
  assistance_type: AssistanceType;
  boarding_station_id: number;
  destination_station_id: number;
  passenger_count: number;
  train_number: string;
  train_set: string;
  direction: Direction;
  status: RequestStatus;
  created_by: number | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  departed_at: string | null;
  departed_by: number | null;
  current_station_id: number | null;
  second_alarm_sent: number;
  second_alarm_at: string | null;
  estimated_arrival_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  completed_by: number | null;
  boarding_name: string;
  destination_name: string;
  current_name: string | null;
  acknowledged_by_name: string | null;
  completed_by_name: string | null;
  created_by_name: string | null;
}

export const REQUEST_SELECT = `
  SELECT r.*, bs.station_name AS boarding_name, ds.station_name AS destination_name,
         cs.station_name AS current_name,
         ua.display_name AS acknowledged_by_name,
         uc.display_name AS completed_by_name,
         ucr.display_name AS created_by_name
    FROM assistance_requests r
    JOIN stations bs ON bs.id = r.boarding_station_id
    JOIN stations ds ON ds.id = r.destination_station_id
    LEFT JOIN stations cs ON cs.id = r.current_station_id
    LEFT JOIN users ua ON ua.id = r.acknowledged_by
    LEFT JOIN users uc ON uc.id = r.completed_by
    LEFT JOIN users ucr ON ucr.id = r.created_by`;

export function mapRequestRow(row: RequestRow, includeDetails = false): AssistanceRequest {
  const journey = journeyForStoredRequest(
    row.boarding_station_id,
    row.destination_station_id,
    row.direction
  );
  const stations: JourneyStation[] = journey ? journey.stations : [];
  const totalStations = journey ? journey.distance : 0;
  const currentOffset = journey ? offsetForStation(journey, row.current_station_id) : 0;

  const result: AssistanceRequest = {
    requestCode: row.request_code,
    assistanceType: row.assistance_type,
    boardingStationId: row.boarding_station_id,
    boardingStation: row.boarding_name,
    destinationStationId: row.destination_station_id,
    destinationStation: row.destination_name,
    passengerCount: row.passenger_count,
    trainNumber: row.train_number,
    trainSet: row.train_set,
    direction: row.direction,
    status: row.status,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by_name,
    departedAt: row.departed_at,
    currentStationId: row.current_station_id,
    currentStation: row.current_name || row.boarding_name,
    currentOffset,
    totalStations,
    remainingStations: Math.max(0, totalStations - currentOffset),
    secondAlarmSent: !!row.second_alarm_sent,
    estimatedArrivalAt: row.estimated_arrival_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by_name,
    createdBy: row.created_by_name || "Station staff",
    journey: stations,
  };

  if (includeDetails) {
    result.movements = q<TrainMovement & { station_name: string; updated_by_name: string | null }>(
      `SELECT tm.id, tm.request_id AS requestId, tm.station_id AS stationId,
              s.station_name AS station_name, tm.offset, tm.created_at AS createdAt,
              u.display_name AS updated_by_name
         FROM train_movements tm
         JOIN stations s ON s.id = tm.station_id
         LEFT JOIN users u ON u.id = tm.updated_by
        WHERE tm.request_id = ?
        ORDER BY tm.created_at ASC, tm.id ASC`,
      row.request_code
    ).map((m) => ({
      id: m.id,
      requestId: m.requestId,
      stationId: m.stationId,
      stationName: m.station_name,
      offset: m.offset,
      updatedBy: m.updated_by_name || "Station staff",
      createdAt: m.createdAt,
    }));

    result.acknowledgements = q<{
      action: "ACKNOWLEDGED" | "COMPLETED";
      station_name: string;
      user_name: string | null;
      created_at: string;
    }>(
      `SELECT ra.action, s.station_name, u.display_name AS user_name, ra.created_at
         FROM request_acknowledgements ra
         JOIN stations s ON s.id = ra.station_id
         LEFT JOIN users u ON u.id = ra.user_id
        WHERE ra.request_id = ?
        ORDER BY ra.created_at ASC`,
      row.request_code
    ).map<Acknowledgement>((a) => ({
      action: a.action,
      stationName: a.station_name,
      userName: a.user_name || "Station staff",
      createdAt: a.created_at,
    }));
  }

  return result;
}

export function getRequestByCode(code: string, includeDetails = false): AssistanceRequest | null {
  const row = q1<RequestRow>(`${REQUEST_SELECT} WHERE r.request_code = ?`, code);
  return row ? mapRequestRow(row, includeDetails) : null;
}

export function getRequestRow(code: string): RequestRow | null {
  const row = q1<RequestRow>(`${REQUEST_SELECT} WHERE r.request_code = ?`, code);
  return row ?? null;
}

export function listStationRequests(stationId: number, limit = 60): AssistanceRequest[] {
  const rows = q<RequestRow>(
    `${REQUEST_SELECT}
      WHERE r.boarding_station_id = ? OR r.destination_station_id = ?
      ORDER BY CASE WHEN r.status = 'COMPLETED' THEN 1 ELSE 0 END, r.created_at DESC
      LIMIT ?`,
    stationId,
    stationId,
    limit
  );
  return rows.map((r) => mapRequestRow(r));
}

export function getStationStats(stationId: number) {
  const row = q1<{
    total: number;
    pending: number;
    acknowledged: number;
    approaching: number;
    completed: number;
  }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN destination_station_id = ? AND status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN destination_station_id = ? AND status IN ('ACKNOWLEDGED','DEPARTED','IN_TRANSIT','ARRIVED') THEN 1 ELSE 0 END) AS acknowledged,
            SUM(CASE WHEN destination_station_id = ? AND status IN ('DEPARTED','IN_TRANSIT') THEN 1 ELSE 0 END) AS approaching,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
       FROM assistance_requests
      WHERE boarding_station_id = ? OR destination_station_id = ?`,
    stationId,
    stationId,
    stationId,
    stationId,
    stationId
  );
  const notices = q1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM other_information WHERE status = 'OPEN'`
  );
  return {
    totalRequests: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    acknowledged: Number(row?.acknowledged || 0),
    approaching: Number(row?.approaching || 0),
    completed: Number(row?.completed || 0),
    activeNotices: Number(notices?.c || 0),
  };
}

export function getDashboard(stationId: number): DashboardData {
  const settings = getSettings();
  if (settings.autoCloseNoticeDays > 0) {
    const cutoff = new Date(Date.now() - settings.autoCloseNoticeDays * 86_400_000).toISOString();
    q(
      `UPDATE other_information
          SET status = 'CLOSED', closed_at = ?
        WHERE status = 'OPEN' AND created_at < ?`,
      nowIso(),
      cutoff
    );
  }
  return {
    stats: getStationStats(stationId),
    requests: listStationRequests(stationId, 40),
    notices: listNotices(stationId, false),
    notifications: notificationRowsForStation(stationId, 30),
    settings,
    serverTime: nowIso(),
  };
}

interface InfoRow {
  info_code: string;
  category: InfoCategory;
  description: string;
  origin_station_id: number;
  image_url: string | null;
  status: "OPEN" | "CLOSED";
  created_at: string;
  closed_at: string | null;
  origin_name: string;
  creator_name: string | null;
  ack_count: number;
  acked_by_me: number;
}

const INFO_SELECT = `
  SELECT i.*, s.station_name AS origin_name, u.display_name AS creator_name,
         (SELECT COUNT(*) FROM information_acknowledgements a WHERE a.info_code = i.info_code) AS ack_count,
         (CASE WHEN EXISTS (SELECT 1 FROM information_acknowledgements a
                             WHERE a.info_code = i.info_code AND a.station_id = ?)
               THEN 1 ELSE 0 END) AS acked_by_me
    FROM other_information i
    JOIN stations s ON s.id = i.origin_station_id
    LEFT JOIN users u ON u.id = i.created_by`;

export function mapInfoRow(row: InfoRow): OtherInfo {
  return {
    infoCode: row.info_code,
    category: row.category,
    description: row.description,
    originStationId: row.origin_station_id,
    originStation: row.origin_name,
    imageUrl: row.image_url,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    createdBy: row.creator_name || "Station staff",
    acknowledgedStations: Number(row.ack_count || 0),
    acknowledgedByMe: !!row.acked_by_me,
  };
}

export function listNotices(stationId: number, includeClosed = false, limit = 30): OtherInfo[] {
  const rows = q<InfoRow>(
    `${INFO_SELECT}
      ${includeClosed ? "" : "WHERE i.status = 'OPEN'"}
      ORDER BY CASE WHEN i.status = 'OPEN' THEN 0 ELSE 1 END, i.created_at DESC
      LIMIT ?`,
    stationId,
    limit
  );
  return rows.map(mapInfoRow);
}

export function getInfoByCode(code: string, stationId: number): OtherInfo | null {
  const row = q1<InfoRow>(`${INFO_SELECT} WHERE i.info_code = ?`, stationId, code);
  return row ? mapInfoRow(row) : null;
}

export function getInfoAckNames(code: string): string[] {
  return q<{ station_name: string }>(
    `SELECT s.station_name
       FROM information_acknowledgements a
       JOIN stations s ON s.id = a.station_id
      WHERE a.info_code = ?
      ORDER BY a.created_at ASC`,
    code
  ).map((r) => r.station_name);
}

export function listLoginStations(): StationOption[] {
  return q<{ id: number; code: string; name: string }>(
    `SELECT DISTINCT s.id, s.station_code AS code, s.station_name AS name
       FROM stations s
       JOIN users u ON u.station_id = s.id AND u.role = 'station' AND u.is_active = 1
      WHERE s.is_active = 1
      ORDER BY s.station_name COLLATE NOCASE`
  );
}

export function listActiveStations(): StationOption[] {
  return q<{ id: number; code: string; name: string }>(
    `SELECT id, station_code AS code, station_name AS name
       FROM stations WHERE is_active = 1 ORDER BY station_name COLLATE NOCASE`
  );
}

export function listAllStations(): StationOption[] {
  return q<{ id: number; code: string; name: string }>(
    `SELECT id, station_code AS code, station_name AS name
       FROM stations ORDER BY station_name COLLATE NOCASE`
  );
}

export function requestNotificationSummary(notification: NotificationItem): string {
  return `${notification.title}: ${notification.body}`;
}
