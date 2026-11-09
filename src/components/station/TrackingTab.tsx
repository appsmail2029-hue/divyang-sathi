"use client";

import {
  AlarmClock,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Radio,
  Siren,
  TrainFront,
} from "lucide-react";
import {
  DirectionPill,
  EmptyState,
  StatusBadge,
  TypePill,
  cn,
  formatTime,
  useNow,
} from "@/components/ui";
import type { AssistanceRequest, DashboardData, JourneyStation, SessionUser } from "@/lib/types";
import RequestActions from "./RequestActions";
import type { StationApi } from "./station-types";

export default function TrackingTab({
  user,
  data,
  api,
  busyCode,
}: {
  user: SessionUser;
  data: DashboardData;
  api: StationApi;
  busyCode: string | null;
}) {
  const now = useNow(15_000);
  const incoming = data.requests.filter(
    (request) =>
      request.destinationStationId === user.stationId &&
      request.status !== "COMPLETED" &&
      request.status !== "ARRIVED"
  );
  const outgoing = data.requests.filter(
    (request) =>
      request.boardingStationId === user.stationId &&
      request.status !== "PENDING" &&
      request.status !== "COMPLETED"
  );
  const arriving = data.requests.filter(
    (request) => request.destinationStationId === user.stationId && request.status === "ARRIVED"
  );

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-navy-950">Manual train tracking</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Train locations are updated manually by the boarding station after departure. The three-station alarm is
              triggered by the saved location, not by a timer. Estimated travel time uses 3 minutes per station.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            <Clock className="h-4 w-4" /> {formatTime(new Date(now).toISOString())} IST
          </div>
        </div>
      </div>

      {arriving.length ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <Check className="h-4 w-4" /> Arrived — assistance pending completion
          </h3>
          {arriving.map((request) => (
            <TrainCard key={request.requestCode} request={request} user={user} api={api} busy={busyCode === request.requestCode} now={now} />
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          <MapPin className="h-4 w-4" /> Incoming to {user.stationName}
        </h3>
        {incoming.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {incoming.map((request) => (
              <TrainCard key={request.requestCode} request={request} user={user} api={api} busy={busyCode === request.requestCode} now={now} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<TrainFront className="h-9 w-9" />}
              title="No trains approaching this station"
              description="Incoming assistance requests will appear here once another station creates a request with this station as the destination."
            />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          <Navigation className="h-4 w-4" /> Trains from {user.stationName}
        </h3>
        {outgoing.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {outgoing.map((request) => (
              <TrainCard key={request.requestCode} request={request} user={user} api={api} busy={busyCode === request.requestCode} now={now} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<TrainFront className="h-9 w-9" />}
              title="No departing trains to track"
              description="After the destination acknowledges a request, mark the train as departed and keep its location updated station by station."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function TrainCard({
  request,
  user,
  api,
  busy,
  now,
}: {
  request: AssistanceRequest;
  user: SessionUser;
  api: StationApi;
  busy: boolean;
  now: number;
}) {
  const isBoarding = request.boardingStationId === user.stationId;
  const etaMs = request.estimatedArrivalAt ? new Date(request.estimatedArrivalAt).getTime() - now : null;
  const etaMinutes = etaMs == null ? null : Math.max(0, Math.ceil(etaMs / 60000));
  const journey = request.journey ?? [];
  const alarmOffset = Math.max(0, request.totalStations - 3);
  const alarmSent = request.secondAlarmSent;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-navy-900">{request.requestCode}</span>
          <StatusBadge status={request.status} />
          <TypePill type={request.assistanceType} />
          <DirectionPill direction={request.direction} />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <TrainFront className="h-4 w-4" /> {request.trainNumber} / Set {request.trainSet}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy-950">
          <span>{request.boardingStation}</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
          <span>{request.destinationStation}</span>
          <span className="text-xs font-medium text-slate-500">· {request.passengerCount} passenger(s)</span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <MiniFact label="Current location" value={request.currentStation || request.boardingStation} />
          <MiniFact
            label="Remaining"
            value={request.remainingStations === 0 ? "Arrived" : `${request.remainingStations} station(s)`}
          />
          <MiniFact
            label="ETA"
            value={
              request.remainingStations === 0
                ? "At platform"
                : request.estimatedArrivalAt
                  ? `${formatTime(request.estimatedArrivalAt)}${etaMinutes != null ? ` (${etaMinutes} min)` : ""}`
                  : "—"
            }
          />
        </div>

        {journey.length ? <JourneyLine journey={journey} request={request} alarmOffset={alarmOffset} alarmSent={alarmSent} /> : null}

        {request.remainingStations <= 3 && request.remainingStations > 0 && request.status === "IN_TRANSIT" ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
            <Siren className="h-4 w-4 animate-blink" />
            {alarmSent
              ? "Approaching alarm already delivered to the destination station."
              : "Within three stations — the destination alarm fires when the location is saved."}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RequestActions request={request} stationId={user.stationId!} busy={busy} api={api} />
          {isBoarding && (request.status === "DEPARTED" || request.status === "IN_TRANSIT") ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Radio className="h-3.5 w-3.5" /> Save each station as it is reached
            </span>
          ) : null}
        </div>

        {request.status === "ACKNOWLEDGED" && isBoarding ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-sky-700">
            <AlarmClock className="h-3.5 w-3.5" /> Destination acknowledged {request.acknowledgedBy ? `(${request.acknowledgedBy})` : ""}. Mark the
            train as departed to start tracking.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="truncate text-xs font-extrabold text-navy-950">{value}</div>
    </div>
  );
}

function JourneyLine({
  journey,
  request,
  alarmOffset,
  alarmSent,
}: {
  journey: JourneyStation[];
  request: AssistanceRequest;
  alarmOffset: number;
  alarmSent: boolean;
}) {
  const currentOffset = request.currentOffset;
  return (
    <div className="scrollbar-thin mt-3 flex items-start gap-0 overflow-x-auto pb-1">
      {journey.map((station, index) => {
        const passed = request.status !== "PENDING" && station.offset <= currentOffset;
        const current = station.id === request.currentStationId && request.status !== "PENDING";
        const isAlarmPoint = station.offset === alarmOffset && alarmOffset > 0;
        return (
          <div key={station.id} className="flex min-w-[64px] flex-1 shrink-0 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", index === 0 ? "bg-transparent" : passed ? "bg-navy-600" : "bg-slate-200")} />
              <span
                className={cn(
                  "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold",
                  current
                    ? "border-navy-700 bg-navy-700 text-white"
                    : passed
                      ? "border-navy-500 bg-navy-100 text-navy-700"
                      : station.isDestination
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-400"
                )}
              >
                {current ? <TrainFront className="h-3.5 w-3.5" /> : station.offset}
                {isAlarmPoint ? (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-2.5 flex h-4 w-4 items-center justify-center rounded-full",
                      alarmSent ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
                    )}
                    title="Three-station alarm point"
                  >
                    <Siren className="h-2.5 w-2.5" />
                  </span>
                ) : null}
              </span>
              <span className={cn("h-0.5 flex-1", station.isDestination ? "bg-transparent" : passed ? "bg-navy-600" : "bg-slate-200")} />
            </div>
            <div
              className={cn(
                "mt-1 line-clamp-2 px-0.5 text-center text-[9px] font-semibold leading-tight",
                current ? "text-navy-900" : passed ? "text-slate-600" : "text-slate-400"
              )}
              title={station.name}
            >
              {station.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
