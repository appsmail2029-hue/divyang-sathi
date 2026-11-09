import { q, q1, exec, nowIso } from "./db";
import { broadcast } from "./events";
import { sendPushToStation } from "./push";
import type { NotificationItem, NotificationPriority } from "./types";

interface NotificationRow {
  id: number;
  kind: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  station_id: number | null;
  request_id: string | null;
  info_id: string | null;
  status: "UNREAD" | "READ" | "SILENCED";
  created_at: string;
  read_at: string | null;
}

export function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    priority: row.priority,
    title: row.title,
    body: row.body,
    stationId: row.station_id,
    requestId: row.request_id,
    infoId: row.info_id,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export interface NotifyOptions {
  stationId: number;
  kind: string;
  priority?: NotificationPriority;
  title: string;
  body: string;
  requestId?: string | null;
  infoId?: string | null;
  dedupeKey?: string | null;
  push?: boolean;
}

/** Persists a notification, then pushes it over SSE and Web Push. Safe to call more than once per dedupe key. */
export function notifyStation(opts: NotifyOptions): NotificationItem | null {
  const priority = opts.priority || "NORMAL";
  const createdAt = nowIso();
  const dedupeKey = opts.dedupeKey ?? null;
  let insertChanges = 1;
  try {
    const res = exec(
      `INSERT OR IGNORE INTO notifications
        (kind, priority, title, body, station_id, request_id, info_id, status, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'UNREAD', ?, ?)`,
      opts.kind,
      priority,
      opts.title,
      opts.body,
      opts.stationId,
      opts.requestId ?? null,
      opts.infoId ?? null,
      dedupeKey,
      createdAt
    );
    insertChanges = res.changes;
  } catch (error) {
    console.error("[notify] insert failed", error);
    return null;
  }

  const row = dedupeKey
    ? q1<NotificationRow>("SELECT * FROM notifications WHERE dedupe_key = ?", dedupeKey)
    : q1<NotificationRow>(
        "SELECT * FROM notifications WHERE station_id = ? ORDER BY id DESC LIMIT 1",
        opts.stationId
      );
  if (!row) return null;
  const item = mapNotification(row);

  if (insertChanges > 0) {
    broadcast({ type: "notification", notification: item }, [opts.stationId]);
    if (opts.push !== false && priority !== "NORMAL") {
      void sendPushToStation(opts.stationId, {
        title: opts.title,
        body: opts.body,
        tag: `metro-${item.id}`,
        url: "/dashboard",
      });
    }
  }
  return item;
}

export function broadcastInfoNotification(input: {
  infoCode: string;
  stationIds: number[];
  title: string;
  body: string;
}) {
  const created: NotificationItem[] = [];
  for (const stationId of input.stationIds) {
    const item = notifyStation({
      stationId,
      kind: "INFO_BROADCAST",
      priority: "HIGH",
      title: input.title,
      body: input.body,
      infoId: input.infoCode,
      dedupeKey: `info:${input.infoCode}:${stationId}`,
    });
    if (item) created.push(item);
  }
  broadcast({ type: "info.created", infoId: input.infoCode });
  return created;
}

export function markNotification(
  id: number,
  stationId: number,
  action: "read" | "silence",
  userId: number
): NotificationItem | null {
  const row = q1<NotificationRow>(
    "SELECT * FROM notifications WHERE id = ? AND (station_id = ? OR station_id IS NULL)",
    id,
    stationId
  );
  if (!row) return null;
  const status = action === "silence" ? "SILENCED" : "READ";
  exec(
    "UPDATE notifications SET status = ?, read_at = ?, read_by = ? WHERE id = ?",
    status,
    nowIso(),
    userId,
    id
  );
  broadcast({ type: "notification.updated", notificationId: id, status }, [stationId]);
  const updated = q1<NotificationRow>("SELECT * FROM notifications WHERE id = ?", id);
  return updated ? mapNotification(updated) : null;
}

export function notificationRowsForStation(stationId: number, limit = 30): NotificationItem[] {
  const rows = q<NotificationRow>(
    `SELECT * FROM notifications
      WHERE station_id = ? OR station_id IS NULL
      ORDER BY created_at DESC LIMIT ?`,
    stationId,
    limit
  );
  return rows.map(mapNotification);
}

export function unreadAlarmNotifications(stationId: number): NotificationItem[] {
  const rows = q<NotificationRow>(
    `SELECT * FROM notifications
      WHERE (station_id = ? OR station_id IS NULL)
        AND status = 'UNREAD'
        AND priority IN ('HIGH', 'CRITICAL')
        AND created_at > ?
      ORDER BY created_at ASC LIMIT 20`,
    stationId,
    new Date(Date.now() - 24 * 3600_000).toISOString()
  );
  return rows.map(mapNotification);
}
