"use client";

import { useEffect, useState } from "react";
import {
  Accessibility,
  AlarmClock,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Siren,
  TrainFront,
  Users,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";
import { Spinner, cn, formatTime, useNow } from "@/components/ui";
import { apiFetch } from "@/lib/client-api";
import type { AssistanceRequest, NotificationItem, SessionUser } from "@/lib/types";
import { ASSISTANCE_LABEL } from "@/lib/types";
import type { StationApi } from "./station-types";

export default function AlarmOverlay({
  alert,
  queueLength,
  user,
  api,
  soundEnabled,
  onEnableSound,
  onDismiss,
  onAcknowledgeInfo,
  busy,
}: {
  alert: NotificationItem;
  queueLength: number;
  user: SessionUser;
  api: StationApi;
  soundEnabled: boolean;
  onEnableSound: () => void;
  onDismiss: (alert: NotificationItem, mode: "read" | "silence") => void;
  onAcknowledgeInfo: (alert: NotificationItem) => void;
  busy: boolean;
}) {
  const [request, setRequest] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const now = useNow(1000);
  const isTest = alert.kind === "TEST_ALARM";
  const isInfo = alert.kind === "INFO_BROADCAST";
  const isCritical = alert.priority === "CRITICAL";

  useEffect(() => {
    setRequest(null);
    if (!alert.requestId || isTest) return;
    let active = true;
    setLoading(true);
    apiFetch<{ request: AssistanceRequest }>(`/api/requests/${encodeURIComponent(alert.requestId)}`)
      .then((data) => {
        if (active) setRequest(data.request);
      })
      .catch(() => {
        /* the notification body still carries the essentials */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [alert.id, alert.requestId, isTest]);

  const isDestination = request ? request.destinationStationId === user.stationId : false;
  const canAcknowledge = !!request && isDestination && request.status === "PENDING";
  const canComplete = !!request && isDestination && request.status === "ARRIVED";
  const etaMs = request?.estimatedArrivalAt ? new Date(request.estimatedArrivalAt).getTime() - now : null;
  const etaMinutes = etaMs == null ? null : Math.max(0, Math.ceil(etaMs / 60000));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-950/80 p-2 backdrop-blur-sm sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label={alert.title}
    >
      <div
        className={cn(
          "w-full max-w-2xl overflow-hidden rounded-3xl border-4 shadow-alarm animate-slideUp",
          isCritical ? "border-red-300" : "border-amber-300"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 px-5 py-3 text-white",
            isCritical ? "animate-flash" : "bg-amber-600"
          )}
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Siren className="h-6 w-6 animate-blink" />
            <span className="absolute inset-0 rounded-full border-2 border-white/70 animate-pulseRing" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/90">
              {isTest
                ? "Test alarm"
                : isInfo
                  ? "Network information broadcast"
                  : isCritical
                    ? "Critical station alarm"
                    : "Priority station alert"}
            </div>
            <div className="truncate text-sm font-bold">
              {alert.priority} priority · {user.stationName} · {formatTime(alert.createdAt)}
            </div>
          </div>
          <div className="hidden shrink-0 rounded-lg bg-black/20 px-2.5 py-1 text-xs font-bold sm:block">
            {queueLength > 1 ? `1 of ${queueLength}` : "Alarm active"}
          </div>
        </div>

        <div className="bg-white px-4 py-5 sm:px-6">
          <h2
            className={cn(
              "text-balance text-center text-xl font-extrabold uppercase leading-tight sm:text-2xl",
              isCritical ? "text-red-700" : "text-amber-800"
            )}
          >
            {alert.title}
          </h2>
          {!isTest ? (
            <p className="mx-auto mt-2 max-w-xl text-center text-sm font-medium text-slate-600">{alert.body}</p>
          ) : (
            <p className="mx-auto mt-2 max-w-xl text-center text-sm font-medium text-slate-600">
              This is a local test of the station siren, flashing popup and browser notification channel. No request was
              created and no other station was contacted.
            </p>
          )}

          {!soundEnabled ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center sm:flex-row sm:text-left">
              <VolumeX className="h-6 w-6 shrink-0 text-amber-700" />
              <div className="flex-1 text-sm font-semibold text-amber-900">
                Alarm sound is off on this device. Enable sound to hear new request alarms.
              </div>
              <button type="button" onClick={onEnableSound} className="btn-yellow btn-sm shrink-0">
                <Volume2 className="h-4 w-4" /> Enable sound
              </button>
            </div>
          ) : null}

          {loading && !isTest ? (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading request details…
            </div>
          ) : null}

          {request && !isTest ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-navy-900">{request.requestCode}</span>
                  <span className="chip bg-navy-100 text-navy-800">{request.direction === "+" ? "+ Circular" : "- Circular"}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  {request.boardingStation}
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <MapPin className="h-4 w-4 text-red-600" />
                  {request.destinationStation}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <DetailTile
                  icon={<TrainFront className="h-4 w-4" />}
                  label="Train / Set"
                  value={`${request.trainNumber} / ${request.trainSet}`}
                />
                <DetailTile
                  icon={<Users className="h-4 w-4" />}
                  label="Passengers"
                  value={String(request.passengerCount).padStart(2, "0")}
                />
                <DetailTile
                  icon={
                    request.assistanceType === "VISUALLY_IMPAIRED" ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <Accessibility className="h-4 w-4" />
                    )
                  }
                  label="Assistance"
                  value={ASSISTANCE_LABEL[request.assistanceType]}
                />
                <DetailTile
                  icon={<MapPin className="h-4 w-4" />}
                  label="Current station"
                  value={request.currentStation || request.boardingStation}
                />
                <DetailTile
                  icon={<Clock className="h-4 w-4" />}
                  label="Stations remaining"
                  value={String(request.remainingStations)}
                />
                <DetailTile
                  icon={<AlarmClock className="h-4 w-4" />}
                  label="Estimated arrival"
                  value={
                    request.estimatedArrivalAt
                      ? `${formatTime(request.estimatedArrivalAt)}${etaMinutes != null ? ` · ${etaMinutes} min` : ""}`
                      : "—"
                  }
                />
              </div>
            </div>
          ) : null}

          {isInfo && alert.infoId ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center">
              <div className="font-mono text-sm font-bold text-sky-950">{alert.infoId}</div>
              <div className="mt-1 text-xs font-semibold text-sky-800">
                Broadcast to all active stations · acknowledge after reading
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {canAcknowledge ? (
              <button
                type="button"
                onClick={() => api.acknowledge(request!.requestCode)}
                disabled={busy}
                className="btn-yellow btn-lg flex-1"
              >
                {busy ? <Spinner /> : <Check className="h-6 w-6" />}
                ACKNOWLEDGE
              </button>
            ) : null}

            {canComplete ? (
              <button
                type="button"
                onClick={() => api.complete(request!.requestCode)}
                disabled={busy}
                className="btn-success btn-lg flex-1"
              >
                {busy ? <Spinner /> : <CheckCircle2 className="h-6 w-6" />}
                ASSISTANCE PROVIDED
              </button>
            ) : null}

            {isInfo ? (
              <>
                <button
                  type="button"
                  onClick={() => onAcknowledgeInfo(alert)}
                  disabled={busy}
                  className="btn-yellow btn-lg flex-1"
                >
                  {busy ? <Spinner /> : <Check className="h-6 w-6" />} ACKNOWLEDGE NOTICE
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(alert, "silence")}
                  className="btn-outline btn-lg flex-1"
                >
                  <VolumeX className="h-5 w-5" /> SILENCE ALARM
                </button>
              </>
            ) : isTest ? (
              <button
                type="button"
                onClick={() => onDismiss(alert, "read")}
                className="btn-danger btn-lg flex-1"
              >
                <VolumeX className="h-6 w-6" /> STOP TEST ALARM
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onDismiss(alert, "silence")}
                  className="btn-outline btn-lg flex-1"
                >
                  <VolumeX className="h-5 w-5" /> SILENCE ALARM
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(alert, "read")}
                  className="btn-ghost min-h-[56px] flex-1 border border-slate-200"
                >
                  <Check className="h-5 w-5" /> Mark as read
                </button>
              </>
            )}
          </div>

          {request ? (
            <button
              type="button"
              onClick={() => api.openDetail(request.requestCode)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-navy-700 underline underline-offset-2"
            >
              View full request, movement history and journey <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}

          <p className="mt-3 text-center text-[11px] text-slate-400">
            The alarm continues flashing and sounding until it is acknowledged or silenced.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
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
