import { q, q1 } from "./db";
import type { Direction, JourneyStation } from "./types";

export interface SequenceStation {
  id: number;
  code: string;
  name: string;
  sequence: number;
  active: boolean;
}

const globalForRoutes = globalThis as unknown as {
  __metroRouteCache?: Map<Direction, SequenceStation[]>;
};

function cache(): Map<Direction, SequenceStation[]> {
  if (!globalForRoutes.__metroRouteCache) globalForRoutes.__metroRouteCache = new Map();
  return globalForRoutes.__metroRouteCache;
}

export function invalidateRouteCache() {
  cache().clear();
}

export function getSequence(direction: Direction): SequenceStation[] {
  const cached = cache().get(direction);
  if (cached) return cached;
  const rows = q<{ id: number; code: string; name: string; sequence: number; active: number }>(
    `SELECT s.id, s.station_code AS code, s.station_name AS name, rs.sequence, s.is_active AS active
       FROM route_sequences rs
       JOIN stations s ON s.id = rs.station_id
      WHERE rs.direction = ?
      ORDER BY rs.sequence ASC`,
    direction
  );
  const result = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sequence: r.sequence,
    active: !!r.active,
  }));
  cache().set(direction, result);
  return result;
}

export function getStationByCode(code: string) {
  return q1<{ id: number; name: string; active: number }>(
    "SELECT id, station_name AS name, is_active AS active FROM stations WHERE station_code = ?",
    code
  );
}

export class RouteError extends Error {}

export interface Journey {
  stations: JourneyStation[];
  distance: number;
}

export function buildJourney(
  boardingStationId: number,
  destinationStationId: number,
  direction: Direction
): Journey {
  if (boardingStationId === destinationStationId) {
    throw new RouteError("Boarding and destination stations must be different.");
  }
  const seq = getSequence(direction);
  if (seq.length < 2) {
    throw new RouteError(
      `The ${direction === "+" ? "+" : "-"} Circular route has not been configured. Contact the administrator.`
    );
  }
  const boardIdx = seq.findIndex((s) => s.id === boardingStationId);
  const destIdx = seq.findIndex((s) => s.id === destinationStationId);
  if (boardIdx === -1 || destIdx === -1) {
    throw new RouteError(
      "One of the selected stations is not part of the chosen circular direction. Check the route configuration."
    );
  }
  const distance = (destIdx - boardIdx + seq.length) % seq.length;
  if (distance === 0) {
    throw new RouteError("Invalid journey distance.");
  }
  const stations: JourneyStation[] = [];
  for (let offset = 0; offset <= distance; offset++) {
    const s = seq[(boardIdx + offset) % seq.length];
    stations.push({
      id: s.id,
      code: s.code,
      name: s.name,
      offset,
      isBoarding: offset === 0,
      isDestination: offset === distance,
    });
  }
  return { stations, distance };
}

export function journeyForStoredRequest(
  boardingStationId: number,
  destinationStationId: number,
  direction: Direction
): Journey | null {
  try {
    return buildJourney(boardingStationId, destinationStationId, direction);
  } catch {
    return null;
  }
}

export function offsetForStation(journey: Journey, stationId: number | null): number {
  if (stationId == null) return 0;
  const idx = journey.stations.findIndex((s) => s.id === stationId);
  return idx === -1 ? 0 : journey.stations[idx].offset;
}

export function nextStations(journey: Journey, currentOffset: number) {
  return journey.stations.filter((s) => s.offset > currentOffset);
}
