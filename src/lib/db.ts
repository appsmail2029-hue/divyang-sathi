import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./crypto";
import type { AppSettings } from "./types";

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "metro.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export const nowIso = () => new Date().toISOString();

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function minutesAfter(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Demonstration Pink Line dataset. NOT official DMRC data — replace via Admin → Stations import. */
const DEMO_STATIONS: Array<[string, string]> = [
  ["AVH", "Anand Vihar ISBT"],
  ["IPE", "IP Extension"],
  ["MWV", "Mandawali-West Vinod Nagar"],
  ["EVN", "East Vinod Nagar-Mayur Vihar-II"],
  ["TLS", "Trilokpuri Sanjay Lake"],
  ["MVP", "Mayur Vihar Pocket 1"],
  ["MVI", "Mayur Vihar-I"],
  ["SKK", "Sarai Kale Khan Nizamuddin"],
  ["ASH", "Ashram"],
  ["VBP", "Vinobapuri"],
  ["LPN", "Lajpat Nagar"],
  ["SEX", "South Extension"],
  ["INA", "INA"],
  ["SNG", "Sarojini Nagar"],
  ["BCP", "Bhikaji Cama Place"],
  ["VMB", "Sir Vishweshwaraiah Moti Bagh"],
  ["DDS", "Durgabai Deshmukh South Campus"],
  ["DCT", "Delhi Cantt"],
  ["NRV", "Naraina Vihar"],
  ["MYP", "Mayapuri"],
  ["RJG", "Rajouri Garden"],
  ["ESI", "ESI Hospital"],
  ["PBW", "Punjabi Bagh West"],
  ["SKP", "Shakurpur"],
  ["NSP", "Netaji Subhash Place"],
  ["SHB", "Shalimar Bagh"],
  ["AZP", "Azadpur"],
  ["MJP", "Majlis Park"],
  ["SHV", "Shiv Vihar"],
  ["JRE", "Johri Enclave"],
  ["GKP", "Gokulpuri"],
  ["MBP", "Maujpur-Babarpur"],
  ["JFB", "Jaffrabad"],
  ["WLC", "Welcome"],
  ["EAN", "East Azad Nagar"],
  ["KRN", "Krishna Nagar"],
  ["KKC", "Karkarduma Court"],
  ["KKD", "Karkarduma"],
];

const DEMO_ACCOUNTS: Array<[string, string, string, string]> = [
  ["anand-vihar", "12345", "Anand Vihar ISBT Staff", "AVH"],
  ["ip-extension", "12345", "IP Extension Staff", "IPE"],
  ["mandawali-vinod-nagar", "12345", "Mandawali-West Vinod Nagar Staff", "MWV"],
  ["east-vinod-nagar", "12345", "East Vinod Nagar-Mayur Vihar-II Staff", "EVN"],
  ["trilokpuri", "12345", "Trilokpuri Sanjay Lake Staff", "TLS"],
  ["mayur-vihar-pocket-1", "12345", "Mayur Vihar Pocket 1 Staff", "MVP"],
  ["mayur-vihar-1", "12345", "Mayur Vihar-I Staff", "MVI"],
  ["sarai-kale-khan", "12345", "Sarai Kale Khan Nizamuddin Staff", "SKK"],
  ["ashram", "12345", "Ashram Staff", "ASH"],
  ["vinobapuri", "12345", "Vinobapuri Staff", "VBP"],
  ["lajpat-nagar", "12345", "Lajpat Nagar Staff", "LPN"],
  ["south-extension", "12345", "South Extension Staff", "SEX"],
  ["ina", "12345", "INA Staff", "INA"],
  ["sarojini-nagar", "12345", "Sarojini Nagar Staff", "SNG"],
  ["bhikaji-cama", "12345", "Bhikaji Cama Place Staff", "BCP"],
  ["moti-bagh", "12345", "Sir Vishweshwaraiah Moti Bagh Staff", "VMB"],
  ["durgabai-deshmukh", "12345", "Durgabai Deshmukh South Campus Staff", "DDS"],
  ["delhi-cantt", "12345", "Delhi Cantt Staff", "DCT"],
  ["naraina-vihar", "12345", "Naraina Vihar Staff", "NRV"],
  ["mayapuri", "12345", "Mayapuri Staff", "MYP"],
  ["rajouri-garden", "12345", "Rajouri Garden Staff", "RJG"],
  ["esi-hospital", "12345", "ESI Hospital Staff", "ESI"],
  ["punjabi-bagh-west", "12345", "Punjabi Bagh West Staff", "PBW"],
  ["shakurpur", "12345", "Shakurpur Staff", "SKP"],
  ["netaji-subhash-place", "12345", "Netaji Subhash Place Staff", "NSP"],
  ["shalimar-bagh", "12345", "Shalimar Bagh Staff", "SHB"],
  ["azadpur", "12345", "Azadpur Staff", "AZP"],
  ["majlis-park", "12345", "Majlis Park Staff", "MJP"],
  ["shiv-vihar", "12345", "Shiv Vihar Staff", "SHV"],
  ["johri-enclave", "12345", "Johri Enclave Staff", "JRE"],
  ["gokulpuri", "12345", "Gokulpuri Staff", "GKP"],
  ["maujpur-babarpur", "12345", "Maujpur-Babarpur Staff", "MBP"],
  ["jaffrabad", "12345", "Jaffrabad Staff", "JFB"],
  ["welcome", "12345", "Welcome Staff", "WLC"],
  ["east-azad-nagar", "12345", "East Azad Nagar Staff", "EAN"],
  ["krishna-nagar", "12345", "Krishna Nagar Staff", "KRN"],
  ["karkarduma-court", "12345", "Karkarduma Court Staff", "KKC"],
  ["karkarduma", "12345", "Karkarduma Staff", "KKD"],
];

function demoModeEnabled(db: DatabaseSync): boolean {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get() as
    | { value: string }
    | undefined;
  return row?.value !== "false";
}

function ensureStationAccounts(db: DatabaseSync) {
  const findStation = db.prepare("SELECT id FROM stations WHERE station_code = ?");
  const findAccount = db.prepare("SELECT id FROM users WHERE station_id = ? AND role = 'station'");
  const findUsername = db.prepare("SELECT id FROM users WHERE username = ?");
  const insert = db.prepare(
    "INSERT INTO users (username, password_hash, display_name, role, station_id, is_active, created_at, updated_at) VALUES (?, ?, ?, 'station', ?, 1, ?, ?)"
  );
  for (const [username, password, displayName, code] of DEMO_ACCOUNTS) {
    const station = findStation.get(code) as { id: number } | undefined;
    if (!station) continue;
    if (findAccount.get(station.id)) continue;
    if (findUsername.get(username)) continue;
    const stamp = nowIso();
    insert.run(username, hashPassword(password), displayName, station.id, stamp, stamp);
  }
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_code TEXT NOT NULL UNIQUE,
      station_name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('+', '-')),
      sequence INTEGER NOT NULL,
      UNIQUE (station_id, direction),
      UNIQUE (direction, sequence)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'station')),
      station_id INTEGER REFERENCES stations(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (role = 'admin' OR station_id IS NOT NULL)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT NOT NULL UNIQUE,
      assistance_type TEXT NOT NULL CHECK (assistance_type IN ('VISUALLY_IMPAIRED', 'WHEELCHAIR')),
      boarding_station_id INTEGER NOT NULL REFERENCES stations(id),
      destination_station_id INTEGER NOT NULL REFERENCES stations(id),
      passenger_count INTEGER NOT NULL CHECK (passenger_count BETWEEN 1 AND 30),
      train_number TEXT NOT NULL,
      train_set TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('+', '-')),
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      acknowledged_by INTEGER REFERENCES users(id),
      departed_at TEXT,
      departed_by INTEGER REFERENCES users(id),
      current_station_id INTEGER REFERENCES stations(id),
      second_alarm_sent INTEGER NOT NULL DEFAULT 0,
      second_alarm_at TEXT,
      estimated_arrival_at TEXT,
      arrived_at TEXT,
      completed_at TEXT,
      completed_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS request_acknowledgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL REFERENCES assistance_requests(request_code) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('ACKNOWLEDGED', 'COMPLETED')),
      station_id INTEGER NOT NULL REFERENCES stations(id),
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE (request_id, action)
    );

    CREATE TABLE IF NOT EXISTS train_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL REFERENCES assistance_requests(request_code) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      offset INTEGER NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS other_information (
      info_code TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('LOST_FOUND', 'SEPARATE_PASSENGER', 'OTHER')),
      description TEXT NOT NULL,
      origin_station_id INTEGER NOT NULL REFERENCES stations(id),
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      closed_at TEXT,
      closed_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('NORMAL', 'HIGH', 'CRITICAL')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
      request_id TEXT REFERENCES assistance_requests(request_code) ON DELETE CASCADE,
      info_id TEXT REFERENCES other_information(info_code) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'SILENCED')),
      dedupe_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      read_at TEXT,
      read_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS information_acknowledgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      info_code TEXT NOT NULL REFERENCES other_information(info_code) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE (info_code, station_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_name TEXT NOT NULL,
      station_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_destination_status ON assistance_requests(destination_station_id, status);
    CREATE INDEX IF NOT EXISTS idx_requests_boarding_status ON assistance_requests(boarding_station_id, status);
    CREATE INDEX IF NOT EXISTS idx_requests_created ON assistance_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_station_status ON notifications(station_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_movements_request ON train_movements(request_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_info_status ON other_information(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_ack_info ON information_acknowledgements(info_code);
  `);
}

function seedSettings(db: DatabaseSync) {
  const defaults: Record<string, string> = {
    seconds_per_station: process.env.SECONDS_PER_STATION || "180",
    alarm_volume: "0.8",
    alarm_repeat_seconds: "8",
    browser_notifications: "true",
    push_enabled: "true",
    auto_close_notice_days: "7",
    demo_mode: "true",
    organization_name: "Delhi Metro — Pink Line",
  };
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
}

function seedData(db: DatabaseSync) {
  const stationCount = (db.prepare("SELECT COUNT(*) AS c FROM stations").get() as { c: number }).c;
  if (stationCount === 0) {
    const insertStation = db.prepare(
      "INSERT INTO stations (station_code, station_name, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)"
    );
    const insertSeq = db.prepare(
      "INSERT INTO route_sequences (station_id, direction, sequence) VALUES (?, ?, ?)"
    );
    const stamp = nowIso();
    const idByCode = new Map<string, number>();
    for (const [code, name] of DEMO_STATIONS) {
      const res = insertStation.run(code, name, stamp, stamp);
      const id = Number(res.lastInsertRowid);
      idByCode.set(code, id);
      insertSeq.run(id, "+", idByCode.size);
    }
    DEMO_STATIONS.forEach(([code], idx) => {
      insertSeq.run(idByCode.get(code)!, "-", DEMO_STATIONS.length - idx);
    });

    // Demo station accounts (prototype only – passwords are documented in README).
    const insertUser = db.prepare(
      "INSERT INTO users (username, password_hash, display_name, role, station_id, is_active, created_at, updated_at) VALUES (?, ?, ?, 'station', ?, 1, ?, ?)"
    );
    const stamp2 = nowIso();
    for (const [username, password, displayName, code] of DEMO_ACCOUNTS) {
      insertUser.run(username, hashPassword(password), displayName, idByCode.get(code)!, stamp2, stamp2);
    }

    // Synthetic completed requests so reports and dashboards are not empty.
    const plus = DEMO_STATIONS.map(([code]) => code);
    const minus = [...plus].reverse();
    const demos = [
      {
        code: "MA-DEMO-0001",
        type: "VISUALLY_IMPAIRED",
        from: "AVH",
        to: "LPN",
        dir: "+" as const,
        pax: 2,
        train: "2890",
        set: "23",
        hoursAgo: 74,
        ackMin: 4,
        completeMin: 46,
      },
      {
        code: "MA-DEMO-0002",
        type: "WHEELCHAIR",
        from: "LPN",
        to: "AVH",
        dir: "-" as const,
        pax: 1,
        train: "4412",
        set: "11",
        hoursAgo: 122,
        ackMin: 6,
        completeMin: 52,
      },
      {
        code: "MA-DEMO-0003",
        type: "VISUALLY_IMPAIRED",
        from: "LPN",
        to: "RJG",
        dir: "+" as const,
        pax: 3,
        train: "3120",
        set: "08",
        hoursAgo: 26,
        ackMin: 3,
        completeMin: 44,
      },
      {
        code: "MA-DEMO-0004",
        type: "WHEELCHAIR",
        from: "AVH",
        to: "DCT",
        dir: "-" as const,
        pax: 2,
        train: "5077",
        set: "31",
        hoursAgo: 7,
        ackMin: 5,
        completeMin: 60,
      },
    ];
    const insertRequest = db.prepare(`
      INSERT INTO assistance_requests (
        request_code, assistance_type, boarding_station_id, destination_station_id,
        passenger_count, train_number, train_set, direction, status, created_by, created_at,
        acknowledged_at, acknowledged_by, departed_at, departed_by, current_station_id,
        second_alarm_sent, second_alarm_at, estimated_arrival_at, arrived_at, completed_at, completed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', NULL, ?, ?, NULL, ?, NULL, ?, 1, ?, ?, ?, ?, NULL)
    `);
    const insertAck = db.prepare(`
      INSERT INTO request_acknowledgements (request_id, action, station_id, user_id, created_at)
      VALUES (?, ?, ?, (SELECT id FROM users WHERE station_id = ?), ?)
    `);
    const insertMove = db.prepare(
      "INSERT INTO train_movements (request_id, station_id, offset, updated_by, created_at) VALUES (?, ?, ?, NULL, ?)"
    );

    for (const demo of demos) {
      const order = demo.dir === "+" ? plus : minus;
      const fromIdx = order.indexOf(demo.from);
      const toIdx = order.indexOf(demo.to);
      const distance = (toIdx - fromIdx + order.length) % order.length;
      const created = hoursAgo(demo.hoursAgo);
      const ack = minutesAfter(created, demo.ackMin);
      const departed = minutesAfter(created, demo.ackMin + 2);
      const done = minutesAfter(created, demo.completeMin);
      const fromId = idByCode.get(demo.from)!;
      const toId = idByCode.get(demo.to)!;
      insertRequest.run(
        demo.code,
        demo.type,
        fromId,
        toId,
        demo.pax,
        demo.train,
        demo.set,
        demo.dir,
        created,
        ack,
        departed,
        toId,
        minutesAfter(created, Math.max(1, distance - 3) * 3 + demo.ackMin + 2),
        minutesAfter(created, demo.completeMin - 4),
        done,
        done
      );
      insertAck.run(demo.code, "ACKNOWLEDGED", toId, toId, ack);
      insertAck.run(demo.code, "COMPLETED", toId, toId, done);
      insertMove.run(demo.code, fromId, 0, departed);
      insertMove.run(demo.code, toId, distance, done);
    }
  }

  // Backfill demo station accounts for existing databases only while demo mode is enabled.
  if (demoModeEnabled(db)) ensureStationAccounts(db);

  // Administrator account
  const adminCount = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as { c: number }
  ).c;
  if (adminCount === 0) {
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, station_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', NULL, 1, ?, ?)`
    ).run(
      process.env.ADMIN_USERNAME || "admin",
      hashPassword(process.env.ADMIN_PASSWORD || "Admin@12345"),
      process.env.ADMIN_NAME || "System Administrator",
      nowIso(),
      nowIso()
    );
  }
}

function initDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  createSchema(db);
  seedSettings(db);
  seedData(db);
  return db;
}

const globalForDb = globalThis as unknown as { __metroDb?: DatabaseSync };

export const db: DatabaseSync = globalForDb.__metroDb ?? initDb();
if (!globalForDb.__metroDb) globalForDb.__metroDb = db;

export function q<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function q1<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function exec(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
  const res = db.prepare(sql).run(...(params as never[]));
  return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw error;
  }
}

export function getSettings(): AppSettings {
  const rows = q<{ key: string; value: string }>("SELECT key, value FROM settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    secondsPerStation: Number(map.get("seconds_per_station") || 180),
    alarmVolume: Number(map.get("alarm_volume") || 0.8),
    alarmRepeatSeconds: Number(map.get("alarm_repeat_seconds") || 8),
    browserNotifications: map.get("browser_notifications") !== "false",
    pushEnabled: map.get("push_enabled") !== "false",
    autoCloseNoticeDays: Number(map.get("auto_close_notice_days") || 7),
    demoMode: map.get("demo_mode") !== "false",
    organizationName: map.get("organization_name") || "Delhi Metro — Pink Line",
  };
}

export function saveSettings(updates: Record<string, string>) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [key, value] of Object.entries(updates)) stmt.run(key, value);
}

export function audit(entry: {
  actorUserId?: number | null;
  actorName: string;
  stationId?: number | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}) {
  exec(
    `INSERT INTO audit_logs (actor_user_id, actor_name, station_id, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.actorUserId ?? null,
    entry.actorName,
    entry.stationId ?? null,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.details ?? null,
    nowIso()
  );
}

export function cleanupSessions() {
  exec("DELETE FROM sessions WHERE expires_at < ?", nowIso());
}
