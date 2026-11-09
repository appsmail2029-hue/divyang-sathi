"use client";

import { useEffect, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  History,
  MapPin,
  Route,
  Ticket,
  TrainFront,
  UserRound,
  Users,
} from "lucide-react";
import {
  StatusBadge,
  TypePill,
  DirectionPill,
  Modal,
  Spinner,
  AlertBanner,
  cn,
  formatDateTime,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import type { AssistanceRequest, SessionUser } from "@/lib/types";
import RequestActions from "./RequestActions";
import type { StationApi } from "./station-types";

export default function RequestDetailModal({
  code,
  user,
  api,
  busy,
  version,
  onClose,
}: {
  code: string | null;
  user: SessionUser;
  api: StationApi;
  busy: boolean;
  version: number;
  onClose: () => void;
}) {
  const [request, setRequest] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setRequest(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiFetch<{ request: AssistanceRequest }>(`/api/requests/${encodeURIComponent(code)}`)
      .then((data) => {
        if (active) setRequest(data.request);
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [code, version]);

  const journey = request?.journey ?? [];
  const currentOffset = request?.currentOffset ?? 0;

  return (
    <Modal
      open={!!code}
      onClose={onClose}
      title={request ? `Request ${request.requestCode}` : "Assistance request"}
      subtitle={
        request
          ? `${request.boardingStation} → ${request.destinationStation} · ${formatDateTime(request.createdAt)}`
          : "Loading request record…"
      }
      icon={<Ticket className="h-6 w-6" />}
      size="xl"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            Close
          </button>
          {request ? <RequestActions request={request} stationId={user.stationId!} busy={busy} api={api} detailed /> : null}
        </>
      }
    >
      {loading && !request ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner /> Loading request details…
        </div>
      ) : null}

      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      {request ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <TypePill type={request.assistanceType} />
            <DirectionPill direction={request.direction} />
            {request.secondAlarmSent ? (
              <span className="chip bg-red-100 text-red-800">3-station alarm sent</span>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Fact icon={<TrainFront className="h-4 w-4" />} label="Train number" value={request.trainNumber} />
            <Fact icon={<TrainFront className="h-4 w-4" />} label="Train set" value={request.trainSet} />
            <Fact icon={<Users className="h-4 w-4" />} label="Passengers" value={String(request.passengerCount)} />
            <Fact
              icon={
                request.assistanceType === "VISUALLY_IMPAIRED" ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Accessibility className="h-4 w-4" />
                )
              }
              label="Assistance type"
              value={request.assistanceType === "VISUALLY_IMPAIRED" ? "Visually Impaired" : "Wheelchair"}
            />
            <Fact icon={<MapPin className="h-4 w-4" />} label="Boarding station" value={request.boardingStation} />
            <Fact icon={<MapPin className="h-4 w-4" />} label="Destination station" value={request.destinationStation} />
            <Fact
              icon={<Route className="h-4 w-4" />}
              label="Stations remaining"
              value={`${request.remainingStations} of ${request.totalStations}`}
            />
            <Fact
              icon={<Clock className="h-4 w-4" />}
              label="Estimated arrival"
              value={
                request.estimatedArrivalAt
                  ? `${formatDateTime(request.estimatedArrivalAt)}`
                  : request.remainingStations === 0
                    ? "Arrived"
                    : "Not departed"
              }
            />
          </div>

          <section>
            <SectionTitle icon={<Route className="h-4 w-4" />}>Journey progress</SectionTitle>
            {journey.length ? (
              <div className="scrollbar-thin mt-2 flex gap-1 overflow-x-auto pb-1">
                {journey.map((station) => {
                  const passed = station.offset < currentOffset;
                  const current = station.id === request.currentStationId && request.status !== "PENDING";
                  return (
                    <div key={station.id} className="flex shrink-0 items-center gap-1">
                      <div
                        className={cn(
                          "max-w-[130px] rounded-lg border px-2.5 py-1.5 text-center",
                          station.isDestination
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 bg-white",
                          current && "border-navy-500 bg-navy-50 ring-2 ring-navy-200"
                        )}
                      >
                        <div
                          className={cn(
                            "truncate text-[11px] font-bold",
                            passed ? "text-slate-400" : "text-navy-900"
                          )}
                        >
                          {station.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {current ? "Train here" : station.isBoarding ? "Boarding" : station.isDestination ? "Destination" : `Station ${station.offset}`}
                        </div>
                      </div>
                      {!station.isDestination ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" /> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Journey route is unavailable. An administrator must verify route sequences.</p>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle icon={<History className="h-4 w-4" />}>Status timeline</SectionTitle>
              <ol className="mt-2 space-y-2">
                <TimelineItem label="Request created" at={request.createdAt} who={request.createdBy} done />
                <TimelineItem
                  label="Destination acknowledged"
                  at={request.acknowledgedAt}
                  who={request.acknowledgedBy}
                  done={!!request.acknowledgedAt}
                />
                <TimelineItem label="Train departed boarding station" at={request.departedAt} done={!!request.departedAt} />
                <TimelineItem
                  label="Three-station alarm triggered"
                  at={null}
                  done={request.secondAlarmSent}
                  hint={request.secondAlarmSent ? "Sent to destination station" : undefined}
                />
                <TimelineItem label="Train arrived at destination" at={request.arrivedAt} done={!!request.arrivedAt} />
                <TimelineItem
                  label="Assistance provided / completed"
                  at={request.completedAt}
                  who={request.completedBy}
                  done={!!request.completedAt}
                />
              </ol>
            </section>

            <section>
              <SectionTitle icon={<TrainFront className="h-4 w-4" />}>Manual movement history</SectionTitle>
              {request.movements && request.movements.length ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <table className="data-table">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th">Station</th>
                        <th className="th">#</th>
                        <th className="th">Updated by</th>
                        <th className="th">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.movements.map((movement) => (
                        <tr key={movement.id}>
                          <td className="td font-semibold text-navy-900">{movement.stationName}</td>
                          <td className="td text-slate-500">{movement.offset}</td>
                          <td className="td text-slate-600">{movement.updatedBy}</td>
                          <td className="td whitespace-nowrap text-slate-500">{formatDateTime(movement.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No train movement has been recorded yet. The boarding station updates the location after departure.
                </p>
              )}
            </section>
          </div>

          <section>
            <SectionTitle icon={<UserRound className="h-4 w-4" />}>Staff acknowledgements</SectionTitle>
            {request.acknowledgements && request.acknowledgements.length ? (
              <div className="mt-2 space-y-1.5">
                {request.acknowledgements.map((ack, index) => (
                  <div key={`${ack.action}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold text-navy-900">{ack.action === "ACKNOWLEDGED" ? "Acknowledged" : "Completed"}</span>
                    <span className="text-slate-600">by {ack.userName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{ack.stationName}</span>
                    <span className="ml-auto text-xs text-slate-500">{formatDateTime(ack.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
                Awaiting acknowledgement from {request.destinationStation}.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span className="text-navy-600">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-extrabold text-navy-950">{value}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
      <span className="text-navy-700">{icon}</span>
      {children}
    </h3>
  );
}

function TimelineItem({
  label,
  at,
  who,
  done,
  hint,
}: {
  label: string;
  at: string | null;
  who?: string | null;
  done: boolean;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
        )}
      >
        {done ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", done ? "text-navy-900" : "text-slate-400")}>{label}</div>
        <div className="text-[11px] text-slate-500">
          {at ? formatDateTime(at, true) : hint || "Pending"}
          {who ? ` · ${who}` : ""}
        </div>
      </div>
    </li>
  );
}
