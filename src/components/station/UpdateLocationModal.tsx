"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  MapPin,
  Navigation,
  Radio,
  TrainFront,
} from "lucide-react";
import { AlertBanner, DirectionPill, Modal, Spinner, cn, formatTime } from "@/components/ui";
import { apiFetch, errorMessage, postJson } from "@/lib/client-api";
import type { AssistanceRequest } from "@/lib/types";
import type { PushToast } from "./station-types";

export default function UpdateLocationModal({
  code,
  onClose,
  onUpdated,
  notify,
}: {
  code: string | null;
  onClose: () => void;
  onUpdated: (request: AssistanceRequest) => void;
  notify: PushToast;
}) {
  const [request, setRequest] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRequest(null);
    setSelected(null);
    setError("");
    if (!code) return;
    let active = true;
    setLoading(true);
    apiFetch<{ request: AssistanceRequest }>(`/api/requests/${encodeURIComponent(code)}`)
      .then((data) => {
        if (active) setRequest(data.request);
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [code]);

  const journey = request?.journey ?? [];
  const currentOffset = request?.currentOffset ?? 0;
  const distance = request ? request.totalStations : 0;
  const ahead = useMemo(
    () => journey.filter((station) => station.offset > currentOffset),
    [journey, currentOffset]
  );
  const selectedStation = ahead.find((station) => station.id === selected);
  const selectedRemaining = selectedStation ? distance - selectedStation.offset : null;

  async function submit() {
    if (!request || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      const { request: updated } = await postJson<{ request: AssistanceRequest }>(
        `/api/requests/${encodeURIComponent(request.requestCode)}/move`,
        { stationId: selected }
      );
      notify(
        "success",
        updated.status === "ARRIVED"
          ? `Train arrived at ${updated.destinationStation}. Destination station has been alerted to provide assistance.`
          : `Train location updated to ${updated.currentStation} — ${updated.remainingStations} station(s) remaining.`
      );
      onUpdated(updated);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!code}
      onClose={onClose}
      title="Update train location"
      subtitle="Select the station the train has just reached, in the selected circular direction."
      icon={<Navigation className="h-6 w-6" />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={submitting || !selected || !request}
          >
            {submitting ? <Spinner /> : <Check className="h-5 w-5" />}
            {submitting ? "Saving location…" : "Save train location"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner /> Loading train journey…
        </div>
      ) : null}

      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      {request ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-navy-100 bg-navy-50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-navy-900">{request.requestCode}</span>
              <DirectionPill direction={request.direction} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">
              <TrainFront className="h-4 w-4" />
              Train {request.trainNumber} / Set {request.trainSet}
              <span className="text-slate-400">·</span>
              <span>{request.passengerCount} passenger(s)</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span>{request.boardingStation}</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="font-semibold">{request.destinationStation}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Current</div>
              <div className="truncate text-sm font-extrabold text-navy-950">
                {request.currentStation || request.boardingStation}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Remaining</div>
              <div className="text-sm font-extrabold text-navy-950">{request.remainingStations}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ETA</div>
              <div className="text-sm font-extrabold text-navy-950">
                {request.remainingStations === 0
                  ? "Arrived"
                  : request.estimatedArrivalAt
                    ? formatTime(request.estimatedArrivalAt)
                    : "—"}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Select current train station</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {ahead.length} station(s) ahead
              </span>
            </div>

            {ahead.length === 0 ? (
              <AlertBanner tone="success" title="Train has reached the destination">
                Mark the request as ASSISTANCE PROVIDED once Divyangjan assistance is handed over.
              </AlertBanner>
            ) : (
              <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
                {journey.map((station) => {
                  const isPast = station.offset <= currentOffset;
                  const isCurrent = station.id === request.currentStationId;
                  const remaining = distance - station.offset;
                  const triggerAlarm = remaining === 3;
                  const isDestination = station.isDestination;
                  if (isPast && !isCurrent) {
                    return (
                      <div
                        key={station.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold">
                          {station.offset}
                        </span>
                        <span className="flex-1 truncate line-through">{station.name}</span>
                        <span className="text-[10px] font-bold uppercase">Passed</span>
                      </div>
                    );
                  }
                  if (isCurrent) {
                    return (
                      <div
                        key={station.id}
                        className="flex items-center gap-3 rounded-xl border-2 border-navy-300 bg-navy-50 px-3 py-2 text-sm"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 text-[10px] font-bold text-white">
                          {station.offset}
                        </span>
                        <span className="flex-1 truncate font-bold text-navy-950">
                          {station.name} <span className="font-normal text-navy-600">(current)</span>
                        </span>
                        <Radio className="h-4 w-4 text-navy-600" />
                      </div>
                    );
                  }
                  return (
                    <label
                      key={station.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors",
                        selected === station.id
                          ? "border-navy-600 bg-navy-50"
                          : "border-slate-200 bg-white hover:border-navy-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="current-station"
                        className="h-4 w-4 accent-[#0b2447]"
                        checked={selected === station.id}
                        onChange={() => setSelected(station.id)}
                      />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-navy-800">
                        {station.offset}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-navy-950">
                          {station.name}
                          {isDestination ? <span className="ml-1 text-xs font-bold text-emerald-700">(destination)</span> : null}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {remaining === 0
                            ? "Arrival — assistance required"
                            : `${remaining} station(s) remaining · approx. ${remaining * 3} min`}
                        </div>
                      </div>
                      {triggerAlarm ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase text-red-700">
                          <AlertTriangle className="h-3 w-3" /> Alarm
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {selectedRemaining != null && selectedRemaining > 0 ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-4 w-4" />
                After saving: {selectedRemaining} station(s) to {request.destinationStation} · approx.{" "}
                {selectedRemaining * 3} min
              </div>
              {selectedRemaining <= 3 ? (
                <div className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {selectedRemaining === 3
                    ? "This will trigger the automatic second alarm at the destination station."
                    : "The second alarm was already triggered when the train was three stations away."}
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            Movement is validated against the {request.direction === "+" ? "+ Circular" : "- Circular"} sequence.
            Backwards movement and movement beyond the destination are rejected by the server.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
