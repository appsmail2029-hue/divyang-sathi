import { HttpError } from "./api";
import { audit, exec, nowIso, q, q1, tx } from "./db";
import { hashPassword } from "./crypto";
import { invalidateRouteCache } from "./route";
import { REQUEST_SELECT, mapRequestRow, type RequestRow } from "./repo";
import type {
  AdminOverview,
  AssistanceType,
  AuditLog,
  Direction,
  ReportPayload,
  ReportRow,
  SessionUser,
  StationOption,
} from "./types";

export interface AdminStation extends StationOption {
  active: boolean;
  plusSeq: number | null;
  minusSeq: number | null;
  userCount: number;
}

export function listAdminStations(): AdminStation[] {
  return q<{
    id: number;
    code: string;
    name: string;
    active: number;
    plus_seq: number | null;
    minus_seq: number | null;
    user_count: number;
  }>(
    `SELECT s.id, s.station_code AS code, s.station_name AS name, s.is_active AS active,
            (SELECT sequence FROM route_sequences WHERE station_id = s.id AND direction = '+') AS plus_seq,
            (SELECT sequence FROM route_sequences WHERE station_id = s.id AND direction = '-') AS minus_seq,
            (SELECT COUNT(*) FROM users u WHERE u.station_id = s.id AND u.is_active = 1) AS user_count
       FROM stations s
      ORDER BY s.station_name COLLATE NOCASE`
  ).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    active: !!r.active,
    plusSeq: r.plus_seq,
    minusSeq: r.minus_seq,
    userCount: Number(r.user_count || 0),
  }));
}

function ensureUniqueStation(code: string, name: string, excludeId?: number) {
  const codeRow = q1<{ id: number }>(
    "SELECT id FROM stations WHERE station_code = ? AND id != COALESCE(?, -1)",
    code,
    excludeId ?? null
  );
  if (codeRow) throw new HttpError(`Station code "${code}" is already in use.`);
  const nameRow = q1<{ id: number }>(
    "SELECT id FROM stations WHERE LOWER(station_name) = LOWER(?) AND id != COALESCE(?, -1)",
    name,
    excludeId ?? null
  );
  if (nameRow) throw new HttpError(`Station name "${name}" is already in use.`);
}

export function createStation(actor: SessionUser, input: { code: string; name: string; active: boolean }) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) throw new HttpError("Station code must be 2–12 letters, digits, hyphen or underscore.");
  if (name.length < 2 || name.length > 90) throw new HttpError("Station name must be between 2 and 90 characters.");
  ensureUniqueStation(code, name);
  const res = exec(
    "INSERT INTO stations (station_code, station_name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    code,
    name,
    input.active ? 1 : 0,
    nowIso(),
    nowIso()
  );
  invalidateRouteCache();
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    stationId: actor.stationId,
    action: "STATION_CREATED",
    entity: "station",
    entityId: String(res.lastInsertRowid),
    details: `${code} — ${name} (${input.active ? "active" : "inactive"})`,
  });
  return { id: res.lastInsertRowid, code, name, active: input.active };
}

export function updateStation(
  actor: SessionUser,
  id: number,
  input: { code: string; name: string; active: boolean }
) {
  const existing = q1<{ id: number; station_code: string; station_name: string }>(
    "SELECT id, station_code, station_name FROM stations WHERE id = ?",
    id
  );
  if (!existing) throw new HttpError("Station not found.");
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) throw new HttpError("Station code must be 2–12 letters, digits, hyphen or underscore.");
  if (name.length < 2 || name.length > 90) throw new HttpError("Station name must be between 2 and 90 characters.");
  ensureUniqueStation(code, name, id);
  tx(() => {
    exec(
      "UPDATE stations SET station_code = ?, station_name = ?, is_active = ?, updated_at = ? WHERE id = ?",
      code,
      name,
      input.active ? 1 : 0,
      nowIso(),
      id
    );
    if (!input.active) {
      exec(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE station_id = ?)",
        id
      );
    }
  });
  invalidateRouteCache();
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    stationId: actor.stationId,
    action: "STATION_UPDATED",
    entity: "station",
    entityId: String(id),
    details: `${existing.station_code} → ${code}, ${existing.station_name} → ${name}, ${input.active ? "active" : "inactive"}`,
  });
  return { id, code, name, active: input.active };
}

export function importStations(
  actor: SessionUser,
  rows: Array<{ code: string; name: string; plusSequence: number | null; minusSequence: number | null; active: boolean }>
) {
  const existing = q<{ id: number; code: string; name: string }>(
    "SELECT id, station_code AS code, station_name AS name FROM stations"
  );
  const existingByCode = new Map(existing.map((s) => [s.code, s]));
  const existingByName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));
  const importedCodes = new Set(rows.map((r) => r.code));

  for (const row of rows) {
    const byName = existingByName.get(row.name.toLowerCase());
    if (byName && byName.code !== row.code) {
      throw new HttpError(
        `Station name "${row.name}" is already assigned to code ${byName.code}. Resolve the conflict before importing.`
      );
    }
  }

  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const stamp = nowIso();

  tx(() => {
    for (const station of existing) {
      if (!importedCodes.has(station.code)) {
        exec("UPDATE stations SET is_active = 0, updated_at = ? WHERE id = ?", stamp, station.id);
        deactivated++;
      }
    }
    for (const row of rows) {
      const found = existingByCode.get(row.code);
      if (found) {
        exec(
          "UPDATE stations SET station_name = ?, is_active = ?, updated_at = ? WHERE id = ?",
          row.name,
          row.active ? 1 : 0,
          stamp,
          found.id
        );
        updated++;
      } else {
        const res = exec(
          "INSERT INTO stations (station_code, station_name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          row.code,
          row.name,
          row.active ? 1 : 0,
          stamp,
          stamp
        );
        existingByCode.set(row.code, { id: res.lastInsertRowid, code: row.code, name: row.name });
        created++;
      }
    }
    exec(
      "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'station' AND station_id IN (SELECT id FROM stations WHERE is_active = 0))"
    );
    exec("DELETE FROM route_sequences");
    for (const row of rows) {
      const station = existingByCode.get(row.code);
      if (!station) continue;
      if (row.plusSequence != null) {
        exec(
          "INSERT INTO route_sequences (station_id, direction, sequence) VALUES (?, '+', ?)",
          station.id,
          row.plusSequence
        );
      }
      if (row.minusSequence != null) {
        exec(
          "INSERT INTO route_sequences (station_id, direction, sequence) VALUES (?, '-', ?)",
          station.id,
          row.minusSequence
        );
      }
    }
  });

  invalidateRouteCache();
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    action: "STATIONS_IMPORTED",
    entity: "station",
    entityId: null,
    details: `Imported ${rows.length} stations (created ${created}, updated ${updated}, deactivated ${deactivated}).`,
  });

  return { created, updated, deactivated, total: rows.length };
}

export function getRoutes(): {
  plus: Array<StationOption & { sequence: number }>;
  minus: Array<StationOption & { sequence: number }>;
} {
  const fetch = (direction: Direction) =>
    q<{ id: number; code: string; name: string; sequence: number }>(
      `SELECT s.id, s.station_code AS code, s.station_name AS name, rs.sequence
         FROM route_sequences rs JOIN stations s ON s.id = rs.station_id
        WHERE rs.direction = ? ORDER BY rs.sequence ASC`,
      direction
    );
  return { plus: fetch("+"), minus: fetch("-") };
}

export function saveRoute(actor: SessionUser, direction: Direction, stationIds: number[]) {
  if (direction !== "+" && direction !== "-") throw new HttpError("Invalid direction.");
  const unique = new Set(stationIds);
  if (unique.size !== stationIds.length) throw new HttpError("A station appears more than once in the sequence.");
  if (!stationIds.length) throw new HttpError("The route sequence cannot be empty.");
  const stations = q<{ id: number; name: string; active: number }>(
    "SELECT id, station_name AS name, is_active AS active FROM stations"
  );
  const byId = new Map(stations.map((s) => [s.id, s]));
  for (const id of stationIds) {
    if (!byId.has(id)) throw new HttpError(`Unknown station id ${id}.`);
  }
  const missing = stations.filter((s) => s.active && !unique.has(s.id));
  if (missing.length) {
    throw new HttpError(
      `Every active station must be placed in the sequence. Missing: ${missing
        .map((s) => s.name)
        .join(", ")}`
    );
  }
  tx(() => {
    exec("DELETE FROM route_sequences WHERE direction = ?", direction);
    stationIds.forEach((stationId, idx) => {
      exec(
        "INSERT INTO route_sequences (station_id, direction, sequence) VALUES (?, ?, ?)",
        stationId,
        direction,
        idx + 1
      );
    });
  });
  invalidateRouteCache();
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    action: "ROUTE_UPDATED",
    entity: "route",
    entityId: direction,
    details: `${direction === "+" ? "+ Circular" : "- Circular"} sequence rewritten with ${stationIds.length} stations.`,
  });
  return { count: stationIds.length };
}

export function verifyRoutes() {
  const issues: string[] = [];
  const activeStations = q<{ id: number; name: string }>(
    "SELECT id, station_name AS name FROM stations WHERE is_active = 1"
  );
  const activeIds = new Set(activeStations.map((s) => s.id));
  const weights: Record<Direction, number> = { "+": 0, "-": 0 };

  for (const direction of ["+", "-"] as Direction[]) {
    const rows = q<{ station_id: number; sequence: number; name: string; active: number }>(
      `SELECT rs.station_id, rs.sequence, s.station_name AS name, s.is_active AS active
         FROM route_sequences rs JOIN stations s ON s.id = rs.station_id
        WHERE rs.direction = ? ORDER BY rs.sequence ASC`,
      direction
    );
    const label = direction === "+" ? "+ Circular" : "- Circular";
    if (!rows.length) {
      issues.push(`${label}: no route sequence configured.`);
      weights[direction] = -1;
      continue;
    }
    weights[direction] = rows.length;
    const seen = new Set<number>();
    rows.forEach((row, idx) => {
      if (row.sequence !== idx + 1) {
        issues.push(`${label}: sequence gap at position ${idx + 1} (found ${row.sequence}).`);
      }
      if (seen.has(row.station_id)) issues.push(`${label}: ${row.name} appears more than once.`);
      seen.add(row.station_id);
      if (!row.active) {
        issues.push(`${label}: inactive station ${row.name} is still on the route.`);
      }
    });
    for (const station of activeStations) {
      if (!seen.has(station.id)) issues.push(`${label}: active station ${station.name} is not on the route.`);
    }
    for (const row of rows) {
      if (!activeIds.has(row.station_id) && row.active) {
        issues.push(`${label}: route references an unknown/inactive station (${row.name}).`);
      }
    }
  }

  if (weights["+"] >= 0 && weights["-"] >= 0 && weights["+"] !== weights["-"]) {
    issues.push("+ Circular and - Circular contain a different number of stations.");
  }

  return {
    ok: issues.length === 0,
    issues,
    activeStations: activeStations.length,
    plusCount: Math.max(weights["+"], 0),
    minusCount: Math.max(weights["-"], 0),
  };
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export function listUsers(): AdminUser[] {
  return q<{
    id: number;
    username: string;
    display_name: string;
    role: "admin" | "station";
    station_id: number | null;
    station_name: string | null;
    active: number;
    must_change_password: number;
    created_at: string;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.station_id, s.station_name,
            u.is_active AS active, u.must_change_password, u.created_at
       FROM users u LEFT JOIN stations s ON s.id = u.station_id
      ORDER BY u.role DESC, s.station_name COLLATE NOCASE, u.username`
  ).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    stationId: u.station_id,
    stationName: u.station_name,
    active: !!u.active,
    mustChangePassword: !!u.must_change_password,
    createdAt: u.created_at,
  }));
}

function validPassword(password: string) {
  if (typeof password !== "string" || password.length < 4 || password.length > 100) {
    throw new HttpError("Password must be between 4 and 100 characters.");
  }
}

export function createUser(
  actor: SessionUser,
  input: {
    username: string;
    displayName: string;
    role: "admin" | "station";
    stationId: number | null;
    password: string;
  }
) {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,30}$/.test(username)) {
    throw new HttpError("Username must be 3–31 characters: lowercase letters, digits, dot, underscore or hyphen.");
  }
  if (!input.displayName.trim()) throw new HttpError("Display name is required.");
  validPassword(input.password);
  if (q1("SELECT id FROM users WHERE username = ?", username)) throw new HttpError("Username already exists.");

  let stationId: number | null = null;
  if (input.role === "station") {
    if (!input.stationId) throw new HttpError("Select a station for station accounts.");
    const station = q1<{ id: number }>("SELECT id FROM stations WHERE id = ?", input.stationId);
    if (!station) throw new HttpError("Station not found.");
    stationId = input.stationId;
  }

  const res = exec(
    `INSERT INTO users (username, password_hash, display_name, role, station_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    username,
    hashPassword(input.password),
    input.displayName.trim(),
    input.role,
    stationId,
    nowIso(),
    nowIso()
  );
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    action: "USER_CREATED",
    entity: "user",
    entityId: String(res.lastInsertRowid),
    details: `${username} (${input.role}${stationId ? `, station ${stationId}` : ""})`,
  });
  return { id: res.lastInsertRowid };
}

export function updateUser(
  actor: SessionUser,
  id: number,
  input: { displayName: string; role: "admin" | "station"; stationId: number | null; active: boolean }
) {
  const existing = q1<{ id: number; username: string; role: "admin" | "station"; active: number }>(
    "SELECT id, username, role, is_active AS active FROM users WHERE id = ?",
    id
  );
  if (!existing) throw new HttpError("User not found.");
  if (id === actor.id && (!input.active || input.role !== "admin")) {
    throw new HttpError("You cannot deactivate or demote your own administrator account.");
  }
  if (input.role === "station" && !input.stationId) throw new HttpError("Select a station for station accounts.");
  if (input.role === "admin" && input.stationId) input.stationId = null;

  if (existing.role === "admin" && (input.role !== "admin" || !input.active)) {
    const admins = q1<{ c: number }>(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?",
      id
    );
    if (Number(admins?.c || 0) === 0) throw new HttpError("At least one active administrator must remain.");
  }
  if (input.stationId) {
    const station = q1("SELECT id FROM stations WHERE id = ?", input.stationId);
    if (!station) throw new HttpError("Station not found.");
  }
  if (!input.displayName.trim()) throw new HttpError("Display name is required.");

  tx(() => {
    exec(
      "UPDATE users SET display_name = ?, role = ?, station_id = ?, is_active = ?, updated_at = ? WHERE id = ?",
      input.displayName.trim(),
      input.role,
      input.role === "station" ? input.stationId : null,
      input.active ? 1 : 0,
      nowIso(),
      id
    );
    if (!input.active || input.role !== existing.role) {
      exec("DELETE FROM sessions WHERE user_id = ?", id);
    }
  });
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    action: "USER_UPDATED",
    entity: "user",
    entityId: String(id),
    details: `${existing.username}: ${input.role}/${input.displayName} ${input.active ? "active" : "inactive"}`,
  });
  return { id };
}

export function resetUserPassword(actor: SessionUser, id: number, password: string) {
  const existing = q1<{ id: number; username: string }>("SELECT id, username FROM users WHERE id = ?", id);
  if (!existing) throw new HttpError("User not found.");
  validPassword(password);
  tx(() => {
    exec(
      "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?",
      hashPassword(password),
      nowIso(),
      id
    );
    exec("DELETE FROM sessions WHERE user_id = ?", id);
  });
  audit({
    actorUserId: actor.id,
    actorName: actor.displayName,
    action: "PASSWORD_RESET",
    entity: "user",
    entityId: String(id),
    details: `Password reset for ${existing.username}.`,
  });
  return { ok: true };
}

export interface AdminRequestFilters {
  status?: string;
  type?: string;
  stationId?: number;
  search?: string;
}

export function adminListRequests(filters: AdminRequestFilters, limit = 300) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    clauses.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.type) {
    clauses.push("r.assistance_type = ?");
    params.push(filters.type);
  }
  if (filters.stationId) {
    clauses.push("(r.boarding_station_id = ? OR r.destination_station_id = ?)");
    params.push(filters.stationId, filters.stationId);
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    clauses.push(
      "(r.request_code LIKE ? OR r.train_number LIKE ? OR r.train_set LIKE ? OR bs.station_name LIKE ? OR ds.station_name LIKE ?)"
    );
    params.push(term, term, term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = q<RequestRow>(
    `${REQUEST_SELECT} ${where} ORDER BY r.created_at DESC LIMIT ?`,
    ...params,
    limit
  );
  return rows.map((r) => mapRequestRow(r));
}

export function listAuditLogs(limit = 200): AuditLog[] {
  return q<{
    id: number;
    actor_name: string;
    station_name: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    details: string | null;
    created_at: string;
  }>(
    `SELECT a.id, a.actor_name, s.station_name, a.action, a.entity, a.entity_id, a.details, a.created_at
       FROM audit_logs a LEFT JOIN stations s ON s.id = a.station_id
      ORDER BY a.created_at DESC LIMIT ?`,
    limit
  ).map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    stationName: r.station_name,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    details: r.details,
    createdAt: r.created_at,
  }));
}

export function getAdminOverview(): AdminOverview {
  const stations = q1<{ total: number; active: number }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM stations"
  );
  const users = q1<{ total: number; active: number; admins: number }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins FROM users"
  );
  const requests = q1<{
    total: number;
    active: number;
    pending: number;
    completed: number;
    today: number;
  }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status != 'COMPLETED' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN substr(created_at,1,10) = substr(?,1,10) THEN 1 ELSE 0 END) AS today
       FROM assistance_requests`,
    nowIso()
  );
  const info = q1<{ open: number; total: number }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open FROM other_information"
  );
  const direction = q<{ direction: Direction; c: number }>(
    "SELECT direction, COUNT(*) AS c FROM assistance_requests GROUP BY direction"
  );
  const recentRows = q<RequestRow>(
    `${REQUEST_SELECT} ORDER BY r.created_at DESC LIMIT 8`
  );

  return {
    stations: { total: Number(stations?.total || 0), active: Number(stations?.active || 0) },
    users: {
      total: Number(users?.total || 0),
      active: Number(users?.active || 0),
      admins: Number(users?.admins || 0),
    },
    requests: {
      total: Number(requests?.total || 0),
      active: Number(requests?.active || 0),
      pending: Number(requests?.pending || 0),
      completed: Number(requests?.completed || 0),
      today: Number(requests?.today || 0),
    },
    info: { open: Number(info?.open || 0), total: Number(info?.total || 0) },
    recentRequests: recentRows.map((r) => mapRequestRow(r)),
    recentAudit: listAuditLogs(8),
    directionSummary: {
      plus: Number(direction.find((d) => d.direction === "+")?.c || 0),
      minus: Number(direction.find((d) => d.direction === "-")?.c || 0),
    },
  };
}

/* ------------------------------ reports ------------------------------ */

const DAY = 86_400_000;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY);
}
function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}
function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}
function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function shortDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function shortMonth(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

interface RawReportRequest {
  assistance_type: AssistanceType;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  boarding_station_id: number;
  boarding_name: string;
  destination_name: string;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function minutesBetween(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null;
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / 60000;
}

export function buildReport(range: "daily" | "weekly" | "monthly"): ReportPayload {
  const now = new Date();
  let buckets: Array<{ start: Date; end: Date; label: string }>;

  if (range === "daily") {
    buckets = Array.from({ length: 14 }, (_, i) => {
      const start = startOfDay(addDays(now, i - 13));
      return { start, end: addDays(start, 1), label: shortDate(start) };
    });
  } else if (range === "weekly") {
    const thisWeek = startOfWeek(now);
    buckets = Array.from({ length: 8 }, (_, i) => {
      const start = addDays(thisWeek, -7 * (7 - i));
      return { start, end: addDays(start, 7), label: `Week ${shortDate(start)}` };
    });
  } else {
    buckets = Array.from({ length: 6 }, (_, i) => {
      const start = startOfMonth(addMonths(now, i - 5));
      return { start, end: addMonths(start, 1), label: shortMonth(start) };
    });
  }

  const fromIso = buckets[0].start.toISOString();
  const rows = q<RawReportRequest>(
    `SELECT r.assistance_type, r.status, r.created_at, r.acknowledged_at, r.completed_at,
            r.boarding_station_id, bs.station_name AS boarding_name, ds.station_name AS destination_name
       FROM assistance_requests r
       JOIN stations bs ON bs.id = r.boarding_station_id
       JOIN stations ds ON ds.id = r.destination_station_id
      WHERE r.created_at >= ?
      ORDER BY r.created_at ASC`,
    fromIso
  );

  const summary = {
    total: rows.length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
    active: rows.filter((r) => r.status !== "COMPLETED").length,
    visuallyImpaired: rows.filter((r) => r.assistance_type === "VISUALLY_IMPAIRED").length,
    wheelchair: rows.filter((r) => r.assistance_type === "WHEELCHAIR").length,
    avgAckMinutes: average(
      rows.map((r) => minutesBetween(r.created_at, r.acknowledged_at)).filter((v): v is number => v != null)
    ),
    avgCompleteMinutes: average(
      rows.map((r) => minutesBetween(r.created_at, r.completed_at)).filter((v): v is number => v != null)
    ),
  };

  const series = buckets.map((bucket) => {
    const inBucket = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= bucket.start.getTime() && t < bucket.end.getTime();
    });
    return {
      label: bucket.label,
      total: inBucket.length,
      completed: inBucket.filter((r) => r.status === "COMPLETED").length,
      visuallyImpaired: inBucket.filter((r) => r.assistance_type === "VISUALLY_IMPAIRED").length,
      wheelchair: inBucket.filter((r) => r.assistance_type === "WHEELCHAIR").length,
    };
  });

  const byStation = new Map<number, RawReportRequest[]>();
  for (const row of rows) {
    const list = byStation.get(row.boarding_station_id) || [];
    list.push(row);
    byStation.set(row.boarding_station_id, list);
  }
  const stationWise: ReportRow[] = Array.from(byStation.entries())
    .map(([id, list]) => {
      const ackTimes = list
        .map((r) => minutesBetween(r.created_at, r.acknowledged_at))
        .filter((v): v is number => v != null);
      const completeTimes = list
        .map((r) => minutesBetween(r.created_at, r.completed_at))
        .filter((v): v is number => v != null);
      return {
        key: String(id),
        label: list[0].boarding_name,
        visuallyImpaired: list.filter((r) => r.assistance_type === "VISUALLY_IMPAIRED").length,
        wheelchair: list.filter((r) => r.assistance_type === "WHEELCHAIR").length,
        total: list.length,
        completed: list.filter((r) => r.status === "COMPLETED").length,
        pending: list.filter((r) => r.status !== "COMPLETED").length,
        avgAckMinutes: average(ackTimes),
        avgCompleteMinutes: average(completeTimes),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    range,
    from: fromIso,
    to: now.toISOString(),
    summary,
    series,
    stationWise,
  };
}

export function exportDatabaseJson() {
  const tables = [
    "stations",
    "route_sequences",
    "users",
    "assistance_requests",
    "request_acknowledgements",
    "train_movements",
    "notifications",
    "other_information",
    "information_acknowledgements",
    "audit_logs",
    "settings",
    "push_subscriptions",
  ];
  const data: Record<string, unknown[]> = {};
  for (const table of tables) {
    const rows = q(`SELECT * FROM ${table}`);
    if (table === "users") {
      data[table] = rows.map((row) => {
        const clone = { ...(row as Record<string, unknown>) };
        delete clone.password_hash;
        return clone;
      });
    } else {
      data[table] = rows;
    }
  }
  return {
    application: "Metro Assist",
    exportedAt: nowIso(),
    notice: "Independent prototype. Contains synthetic demonstration data unless replaced by the administrator.",
    tables: data,
  };
}
