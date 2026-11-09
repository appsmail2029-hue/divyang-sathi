import { randomBytes } from "node:crypto";
import { HttpError } from "./api";
import { audit, exec, getSettings, nowIso, q, q1, tx } from "./db";
import { broadcast } from "./events";
import { broadcastInfoNotification, notifyStation } from "./notify";
import { getInfoByCode, getRequestByCode, getRequestRow } from "./repo";
import { buildJourney, offsetForStation, RouteError } from "./route";
import type {
  AssistanceType,
  Direction,
  InfoCategory,
  OtherInfo,
  SessionUser,
} from "./types";
import { ASSISTANCE_LABEL, DIRECTION_LABEL, INFO_LABEL } from "./types";

function code(prefix: string): string {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `${prefix}-${stamp}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function uniqueRequestCode(): string {
  for (let i = 0; i < 8; i++) {
    const candidate = code("MA");
    if (!q1("SELECT 1 AS x FROM assistance_requests WHERE request_code = ?", candidate)) return candidate;
  }
  throw new HttpError("Could not generate a unique request ID. Try again.", 500);
}

function uniqueInfoCode(): string {
  for (let i = 0; i < 8; i++) {
    const candidate = code("INFO");
    if (!q1("SELECT 1 AS x FROM other_information WHERE info_code = ?", candidate)) return candidate;
  }
  throw new HttpError("Could not generate a unique information ID. Try again.", 500);
}

function istTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

function boardingCheck(user: SessionUser, row: { boarding_station_id: number }) {
  if (user.stationId !== row.boarding_station_id) {
    throw new HttpError("Only the boarding station can perform this action.", 403);
  }
}

function destinationCheck(user: SessionUser, row: { destination_station_id: number }) {
  if (user.stationId !== row.destination_station_id) {
    throw new HttpError("Only the destination station can perform this action.", 403);
  }
}

export function createAssistanceRequest(
  user: SessionUser,
  input: {
    assistanceType: AssistanceType;
    destinationStationId: number;
    passengerCount: number;
    trainNumber: string;
    trainSet: string;
    direction: Direction;
  }
) {
  const boardingStationId = user.stationId;
  if (boardingStationId == null) throw new HttpError("No station is linked to this account.", 403);
  if (input.assistanceType !== "VISUALLY_IMPAIRED" && input.assistanceType !== "WHEELCHAIR") {
    throw new HttpError("Select a valid assistance type.", 400);
  }
  if (input.direction !== "+" && input.direction !== "-") {
    throw new HttpError("Select + Circular or - Circular.", 400);
  }
  if (input.destinationStationId === boardingStationId) {
    throw new HttpError("Destination must be different from the boarding station.", 400);
  }
  const destination = q1<{ id: number; station_name: string; is_active: number }>(
    "SELECT id, station_name, is_active FROM stations WHERE id = ?",
    input.destinationStationId
  );
  if (!destination) throw new HttpError("Destination station not found.", 400);
  if (!destination.is_active) throw new HttpError("Destination station is inactive.", 400);
  if (!/^[A-Za-z0-9-]{1,12}$/.test(input.trainNumber)) {
    throw new HttpError("Train number may contain up to 12 letters, digits or hyphens.", 400);
  }
  if (!/^[A-Za-z0-9-]{1,12}$/.test(input.trainSet)) {
    throw new HttpError("Train set may contain up to 12 letters, digits or hyphens.", 400);
  }
  if (input.passengerCount < 1 || input.passengerCount > 30) {
    throw new HttpError("Number of passengers must be between 1 and 30.", 400);
  }

  let journey;
  try {
    journey = buildJourney(boardingStationId, input.destinationStationId, input.direction);
  } catch (error) {
    throw new HttpError(error instanceof RouteError ? error.message : "Route not configured.", 400);
  }

  const requestCode = uniqueRequestCode();
  const createdAt = nowIso();
  exec(
    `INSERT INTO assistance_requests
      (request_code, assistance_type, boarding_station_id, destination_station_id, passenger_count,
       train_number, train_set, direction, status, created_by, created_at, current_station_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    requestCode,
    input.assistanceType,
    boardingStationId,
    input.destinationStationId,
    input.passengerCount,
    input.trainNumber.toUpperCase(),
    input.trainSet.toUpperCase(),
    input.direction,
    user.id,
    createdAt,
    boardingStationId
  );

  notifyStation({
    stationId: input.destinationStationId,
    kind: "NEW_REQUEST",
    priority: "HIGH",
    title: "NEW ASSISTANCE REQUEST",
    body: `${ASSISTANCE_LABEL[input.assistanceType]} · ${input.passengerCount} passenger(s) · Train ${input.trainNumber.toUpperCase()} / Set ${input.trainSet.toUpperCase()} from ${user.stationName} (${DIRECTION_LABEL[input.direction]}). Please acknowledge.`,
    requestId: requestCode,
    dedupeKey: `new-request:${requestCode}`,
  });

  notifyStation({
    stationId: boardingStationId,
    kind: "REQUEST_CREATED",
    priority: "HIGH",
    title: "ASSISTANCE REQUEST CREATED — DESTINATION NOTIFIED",
    body: `${requestCode} · ${ASSISTANCE_LABEL[input.assistanceType]} · ${input.passengerCount} passenger(s) · Train ${input.trainNumber.toUpperCase()} / Set ${input.trainSet.toUpperCase()} to ${destination.station_name}. The destination station has been alerted.`,
    requestId: requestCode,
    dedupeKey: `request-created:${requestCode}`,
  });

  broadcast({ type: "request.created", requestCode }, [boardingStationId, input.destinationStationId]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: boardingStationId,
    action: "REQUEST_CREATED",
    entity: "assistance_request",
    entityId: requestCode,
    details: `${ASSISTANCE_LABEL[input.assistanceType]}, ${destination.station_name}, ${input.passengerCount} passenger(s), train ${input.trainNumber}/${input.trainSet}, ${DIRECTION_LABEL[input.direction]}, journey ${journey.distance} stations.`,
  });

  return getRequestByCode(requestCode, true)!;
}

export function acknowledgeRequest(user: SessionUser, requestCode: string) {
  const row = getRequestRow(requestCode);
  if (!row) throw new HttpError("Request not found.", 404);
  destinationCheck(user, row);
  if (row.status !== "PENDING") {
    throw new HttpError(
      row.status === "ACKNOWLEDGED" || row.status === "DEPARTED" || row.status === "IN_TRANSIT" || row.status === "ARRIVED" || row.status === "COMPLETED"
        ? "This request has already been acknowledged."
        : "This request cannot be acknowledged.",
      409
    );
  }
  const stamp = nowIso();
  tx(() => {
    const res = exec(
      `UPDATE assistance_requests
          SET status = 'ACKNOWLEDGED', acknowledged_at = ?, acknowledged_by = ?
        WHERE request_code = ? AND destination_station_id = ? AND status = 'PENDING'`,
      stamp,
      user.id,
      requestCode,
      user.stationId!
    );
    if (!res.changes) throw new HttpError("This request has already been acknowledged.", 409);
    exec(
      `INSERT OR IGNORE INTO request_acknowledgements (request_id, action, station_id, user_id, created_at)
       VALUES (?, 'ACKNOWLEDGED', ?, ?, ?)`,
      requestCode,
      user.stationId!,
      user.id,
      stamp
    );
    exec(
      `UPDATE notifications SET status = 'READ', read_at = ?, read_by = ?
        WHERE request_id = ? AND station_id = ? AND status = 'UNREAD'`,
      stamp,
      user.id,
      requestCode,
      user.stationId!
    );
  });

  notifyStation({
    stationId: row.boarding_station_id,
    kind: "REQUEST_ACKNOWLEDGED",
    priority: "NORMAL",
    title: "REQUEST ACKNOWLEDGED",
    body: `${row.destination_name} acknowledged request ${requestCode}. You may now mark the train as departed.`,
    requestId: requestCode,
    dedupeKey: `ack:${requestCode}`,
  });
  broadcast({ type: "request.updated", requestCode }, [row.boarding_station_id, row.destination_station_id]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "REQUEST_ACKNOWLEDGED",
    entity: "assistance_request",
    entityId: requestCode,
  });
  return getRequestByCode(requestCode, true)!;
}

export function silenceRequestAlarms(user: SessionUser, requestCode: string) {
  const row = getRequestRow(requestCode);
  if (!row) throw new HttpError("Request not found.", 404);
  destinationCheck(user, row);
  exec(
    `UPDATE notifications SET status = 'SILENCED', read_at = ?, read_by = ?
      WHERE request_id = ? AND station_id = ? AND status = 'UNREAD'`,
    nowIso(),
    user.id,
    requestCode,
    user.stationId!
  );
  broadcast({ type: "notification.updated", requestCode }, [user.stationId!]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "ALARM_SILENCED",
    entity: "assistance_request",
    entityId: requestCode,
  });
  return { ok: true };
}

export function departTrain(user: SessionUser, requestCode: string) {
  const row = getRequestRow(requestCode);
  if (!row) throw new HttpError("Request not found.", 404);
  boardingCheck(user, row);
  if (row.status !== "ACKNOWLEDGED") {
    throw new HttpError(
      row.status === "PENDING"
        ? "The destination station must acknowledge the request before departure."
        : "The train has already departed or the request is closed.",
      409
    );
  }
  let journey;
  try {
    journey = buildJourney(row.boarding_station_id, row.destination_station_id, row.direction);
  } catch (error) {
    throw new HttpError(error instanceof RouteError ? error.message : "Route not configured.", 400);
  }
  const settings = getSettings();
  const stamp = nowIso();
  const eta = new Date(Date.now() + journey.distance * settings.secondsPerStation * 1000).toISOString();

  tx(() => {
    const res = exec(
      `UPDATE assistance_requests
          SET status = 'DEPARTED', departed_at = ?, departed_by = ?, current_station_id = ?, estimated_arrival_at = ?
        WHERE request_code = ? AND boarding_station_id = ? AND status = 'ACKNOWLEDGED'`,
      stamp,
      user.id,
      row.boarding_station_id,
      eta,
      requestCode,
      user.stationId!
    );
    if (!res.changes) throw new HttpError("The request is no longer in an acknowledged state.", 409);
    exec(
      "INSERT INTO train_movements (request_id, station_id, offset, updated_by, created_at) VALUES (?, ?, 0, ?, ?)",
      requestCode,
      row.boarding_station_id,
      user.id,
      stamp
    );
  });

  notifyStation({
    stationId: row.destination_station_id,
    kind: "TRAIN_DEPARTED",
    priority: "NORMAL",
    title: "TRAIN DEPARTED",
    body: `Train ${row.train_number} / Set ${row.train_set} has departed ${row.boarding_name} towards ${row.destination_name}. Estimated arrival ${istTime(eta)}.`,
    requestId: requestCode,
    dedupeKey: `departed:${requestCode}`,
  });
  broadcast({ type: "request.updated", requestCode }, [row.boarding_station_id, row.destination_station_id]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "TRAIN_DEPARTED",
    entity: "assistance_request",
    entityId: requestCode,
    details: `Departed ${row.boarding_name}; ${journey.distance} stations to ${row.destination_name}.`,
  });
  return getRequestByCode(requestCode, true)!;
}

export function moveTrain(user: SessionUser, requestCode: string, stationId: number) {
  const row = getRequestRow(requestCode);
  if (!row) throw new HttpError("Request not found.", 404);
  boardingCheck(user, row);
  if (row.status !== "DEPARTED" && row.status !== "IN_TRANSIT") {
    throw new HttpError(
      row.status === "ACKNOWLEDGED"
        ? "Mark the train as departed before updating its location."
        : "Train movement is closed for this request.",
      409
    );
  }
  let journey;
  try {
    journey = buildJourney(row.boarding_station_id, row.destination_station_id, row.direction);
  } catch (error) {
    throw new HttpError(error instanceof RouteError ? error.message : "Route not configured.", 400);
  }
  const currentOffset = offsetForStation(journey, row.current_station_id);
  const target = journey.stations.find((s) => s.id === stationId);
  if (!target) {
    throw new HttpError("The selected station is not on this journey in the chosen direction.", 400);
  }
  if (target.offset <= currentOffset) {
    throw new HttpError("The train cannot move backwards. Select a station ahead of the current location.", 400);
  }
  if (target.offset > journey.distance) {
    throw new HttpError("The train cannot move beyond the destination station.", 400);
  }

  const settings = getSettings();
  const remaining = journey.distance - target.offset;
  const stamp = nowIso();
  const eta =
    remaining === 0
      ? stamp
      : new Date(Date.now() + remaining * settings.secondsPerStation * 1000).toISOString();
  const arrived = remaining === 0;
  const secondAlarmDue = !arrived && remaining <= 3 && !row.second_alarm_sent;

  tx(() => {
    exec(
      `UPDATE assistance_requests
          SET status = ?, current_station_id = ?, estimated_arrival_at = ?,
              arrived_at = CASE WHEN ? THEN ? ELSE arrived_at END,
              second_alarm_sent = CASE WHEN ? THEN 1 ELSE second_alarm_sent END,
              second_alarm_at = CASE WHEN ? THEN ? ELSE second_alarm_at END
        WHERE request_code = ? AND boarding_station_id = ?`,
      arrived ? "ARRIVED" : "IN_TRANSIT",
      stationId,
      eta,
      arrived ? 1 : 0,
      stamp,
      secondAlarmDue ? 1 : 0,
      secondAlarmDue ? 1 : 0,
      stamp,
      requestCode,
      user.stationId!
    );
    exec(
      "INSERT INTO train_movements (request_id, station_id, offset, updated_by, created_at) VALUES (?, ?, ?, ?, ?)",
      requestCode,
      stationId,
      target.offset,
      user.id,
      stamp
    );
  });

  if (arrived) {
    notifyStation({
      stationId: row.destination_station_id,
      kind: "TRAIN_ARRIVED",
      priority: "HIGH",
      title: "TRAIN ARRIVED — ASSISTANCE REQUIRED",
      body: `Train ${row.train_number} / Set ${row.train_set} has arrived at ${row.destination_name}. ${row.passenger_count} passenger(s) require ${ASSISTANCE_LABEL[row.assistance_type]} assistance. Mark ASSISTANCE PROVIDED once complete.`,
      requestId: requestCode,
      dedupeKey: `arrived:${requestCode}`,
    });
  } else if (secondAlarmDue) {
    notifyStation({
      stationId: row.destination_station_id,
      kind: "APPROACHING_ALARM",
      priority: "CRITICAL",
      title: "TRAIN APPROACHING – PLEASE PREPARE FOR DIVYANGJAN ASSISTANCE.",
      body: `Train ${row.train_number} / Set ${row.train_set} · ${row.passenger_count} passenger(s) · ${ASSISTANCE_LABEL[row.assistance_type]} · ${target.name} (${remaining} station${remaining === 1 ? "" : "s"} remaining) · ETA ${istTime(eta)}.`,
      requestId: requestCode,
      dedupeKey: `second-alarm:${requestCode}`,
    });
  }

  broadcast({ type: "request.updated", requestCode }, [row.boarding_station_id, row.destination_station_id]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: arrived ? "TRAIN_ARRIVED" : secondAlarmDue ? "SECOND_ALARM_TRIGGERED" : "TRAIN_MOVED",
    entity: "assistance_request",
    entityId: requestCode,
    details: `${target.name} (station ${target.offset} of ${journey.distance}); ${remaining} remaining.`,
  });
  return getRequestByCode(requestCode, true)!;
}

export function completeRequest(user: SessionUser, requestCode: string) {
  const row = getRequestRow(requestCode);
  if (!row) throw new HttpError("Request not found.", 404);
  destinationCheck(user, row);
  if (row.status === "COMPLETED") throw new HttpError("This request is already completed.", 409);
  if (row.status !== "ARRIVED") {
    throw new HttpError("Assistance can only be completed after the train has arrived at this station.", 409);
  }
  const stamp = nowIso();
  tx(() => {
    const res = exec(
      `UPDATE assistance_requests
          SET status = 'COMPLETED', completed_at = ?, completed_by = ?
        WHERE request_code = ? AND destination_station_id = ? AND status = 'ARRIVED'`,
      stamp,
      user.id,
      requestCode,
      user.stationId!
    );
    if (!res.changes) throw new HttpError("This request is no longer awaiting completion.", 409);
    exec(
      `INSERT OR IGNORE INTO request_acknowledgements (request_id, action, station_id, user_id, created_at)
       VALUES (?, 'COMPLETED', ?, ?, ?)`,
      requestCode,
      user.stationId!,
      user.id,
      stamp
    );
    exec(
      `UPDATE notifications SET status = 'READ', read_at = ?, read_by = ?
        WHERE request_id = ? AND station_id = ? AND status = 'UNREAD'`,
      stamp,
      user.id,
      requestCode,
      user.stationId!
    );
  });

  notifyStation({
    stationId: row.boarding_station_id,
    kind: "REQUEST_COMPLETED",
    priority: "NORMAL",
    title: "ASSISTANCE PROVIDED",
    body: `${row.destination_name} marked assistance for ${requestCode} as provided at ${istTime(stamp)}.`,
    requestId: requestCode,
    dedupeKey: `completed:${requestCode}`,
  });
  broadcast({ type: "request.updated", requestCode }, [row.boarding_station_id, row.destination_station_id]);
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "ASSISTANCE_COMPLETED",
    entity: "assistance_request",
    entityId: requestCode,
    details: `Completed at ${row.destination_name}.`,
  });
  return getRequestByCode(requestCode, true)!;
}

export function createInformation(
  user: SessionUser,
  input: { category: InfoCategory; description: string; imageUrl?: string | null }
): { info: OtherInfo; notified: number } {
  if (!["LOST_FOUND", "SEPARATE_PASSENGER", "OTHER"].includes(input.category)) {
    throw new HttpError("Select a valid information category.", 400);
  }
  const description = input.description.trim();
  if (description.length < 5) throw new HttpError("Please provide a description (at least 5 characters).", 400);
  if (description.length > 1200) throw new HttpError("Description is too long (max 1200 characters).", 400);
  let imageUrl: string | null = null;
  if (input.imageUrl) {
    if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(input.imageUrl)) {
      throw new HttpError("Invalid image reference.", 400);
    }
    imageUrl = input.imageUrl;
  }
  if (user.stationId == null || !user.stationName) throw new HttpError("No station linked to this account.", 403);

  const infoCode = uniqueInfoCode();
  const createdAt = nowIso();
  exec(
    `INSERT INTO other_information (info_code, category, description, origin_station_id, image_url, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
    infoCode,
    input.category,
    description,
    user.stationId,
    imageUrl,
    user.id,
    createdAt
  );

  const stationIds = q<{ id: number }>("SELECT id FROM stations WHERE is_active = 1").map((r) => r.id);
  broadcastInfoNotification({
    infoCode,
    stationIds,
    title: `${INFO_LABEL[input.category].toUpperCase()} — ${user.stationName}`,
    body: description.length > 220 ? `${description.slice(0, 217)}…` : description,
  });

  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "INFO_CREATED",
    entity: "other_information",
    entityId: infoCode,
    details: `${INFO_LABEL[input.category]} broadcast to ${stationIds.length} active stations.`,
  });

  return { info: getInfoByCode(infoCode, user.stationId)!, notified: stationIds.length };
}

export function acknowledgeInformation(user: SessionUser, infoCode: string) {
  if (user.stationId == null) throw new HttpError("No station linked to this account.", 403);
  const info = getInfoByCode(infoCode, user.stationId);
  if (!info) throw new HttpError("Information notice not found.", 404);
  if (info.status !== "OPEN") throw new HttpError("This notice has already been closed.", 409);
  const stamp = nowIso();
  tx(() => {
    exec(
      `INSERT OR IGNORE INTO information_acknowledgements (info_code, station_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
      infoCode,
      user.stationId!,
      user.id,
      stamp
    );
    exec(
      `UPDATE notifications SET status = 'READ', read_at = ?, read_by = ?
        WHERE info_id = ? AND station_id = ? AND status = 'UNREAD'`,
      stamp,
      user.id,
      infoCode,
      user.stationId!
    );
  });
  broadcast({ type: "info.updated", infoCode });
  audit({
    actorUserId: user.id,
    actorName: user.displayName,
    stationId: user.stationId,
    action: "INFO_ACKNOWLEDGED",
    entity: "other_information",
    entityId: infoCode,
  });
  return getInfoByCode(infoCode, user.stationId)!;
}

export function closeInformation(admin: SessionUser, infoCode: string) {
  const info = q1<{ info_code: string; status: string }>(
    "SELECT info_code, status FROM other_information WHERE info_code = ?",
    infoCode
  );
  if (!info) throw new HttpError("Information notice not found.", 404);
  if (info.status === "CLOSED") throw new HttpError("This notice is already closed.", 409);
  exec(
    "UPDATE other_information SET status = 'CLOSED', closed_at = ?, closed_by = ? WHERE info_code = ?",
    nowIso(),
    admin.id,
    infoCode
  );
  broadcast({ type: "info.updated", infoCode });
  audit({
    actorUserId: admin.id,
    actorName: admin.displayName,
    stationId: admin.stationId,
    action: "INFO_CLOSED",
    entity: "other_information",
    entityId: infoCode,
  });
  return { ok: true };
}
