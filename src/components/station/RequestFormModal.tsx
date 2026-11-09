"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CircleDot,
  Minus,
  Plus,
  Route,
  Ticket,
  TrainFront,
  Users,
} from "lucide-react";
import { Modal, Spinner, AlertBanner, DirectionPill, formatTime } from "@/components/ui";
import { apiFetch, errorDetails, errorMessage, postJson } from "@/lib/client-api";
import type { AssistanceRequest, AssistanceType, Direction, SessionUser, StationOption } from "@/lib/types";
import { ASSISTANCE_LABEL } from "@/lib/types";

interface Preview {
  distance: number;
  etaMinutes: number;
  journey: Array<{ id: number; name: string; code: string; offset: number }>;
}

export default function RequestFormModal({
  open,
  type,
  user,
  onClose,
  onCreated,
}: {
  open: boolean;
  type: AssistanceType;
  user: SessionUser;
  onClose: () => void;
  onCreated: (request: AssistanceRequest) => void;
}) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [destination, setDestination] = useState("");
  const [direction, setDirection] = useState<Direction>("+");
  const [passengers, setPassengers] = useState(2);
  const [trainNumber, setTrainNumber] = useState("");
  const [trainSet, setTrainSet] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorList, setErrorList] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDestination("");
    setDirection("+");
    setPassengers(2);
    setTrainNumber("");
    setTrainSet("");
    setPreview(null);
    setPreviewError("");
    setShowRoute(false);
    setError("");
    setErrorList([]);
    setLoadingStations(true);
    apiFetch<{ stations: StationOption[] }>("/api/stations")
      .then((data) => setStations(data.stations.filter((s) => s.id !== user.stationId)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoadingStations(false));
  }, [open, user.stationId]);

  useEffect(() => {
    if (!open || !destination) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPreviewing(true);
    setPreviewError("");
    const timer = setTimeout(() => {
      apiFetch<Preview>(
        `/api/route/preview?direction=${encodeURIComponent(direction)}&to=${destination}`,
        { signal: controller.signal }
      )
        .then((data) => {
          if (active) setPreview(data);
        })
        .catch((err) => {
          if (!active) return;
          setPreview(null);
          if (err instanceof Error && err.name === "AbortError") return;
          setPreviewError(errorMessage(err));
        })
        .finally(() => active && setPreviewing(false));
    }, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, destination, direction]);

  const adjustPassengers = (delta: number) => {
    setPassengers((value) => Math.min(30, Math.max(1, value + delta)));
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setErrorList([]);
    if (!destination) {
      setError("Select the station where assistance is required.");
      return;
    }
    if (!trainNumber.trim() || !trainSet.trim()) {
      setError("Enter both the train number and train set.");
      return;
    }
    setSubmitting(true);
    try {
      const { request } = await postJson<{ request: AssistanceRequest }>("/api/requests", {
        assistanceType: type,
        destinationStationId: Number(destination),
        passengerCount: passengers,
        trainNumber: trainNumber.trim(),
        trainSet: trainSet.trim(),
        direction,
      });
      onCreated(request);
    } catch (err) {
      setError(errorMessage(err));
      setErrorList(errorDetails(err));
      setSubmitting(false);
    }
  }

  const destinationName = stations.find((s) => String(s.id) === destination)?.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`New ${ASSISTANCE_LABEL[type]} assistance request`}
      subtitle="The destination station is alerted immediately and must acknowledge before departure."
      icon={<TrainFront className="h-6 w-6" />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="assistance-form" className="btn-yellow" disabled={submitting || !destination}>
            {submitting ? <Spinner /> : <ArrowRight className="h-5 w-5" />}
            {submitting ? "Creating request…" : "Create request & notify destination"}
          </button>
        </>
      }
    >
      <form id="assistance-form" onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Assistance type</span>
            <div className="flex min-h-[48px] items-center gap-2 rounded-xl border border-navy-100 bg-navy-50 px-4 text-sm font-semibold text-navy-900">
              {ASSISTANCE_LABEL[type]}
            </div>
          </div>
          <div>
            <span className="label">Boarding station (from login)</span>
            <div className="flex min-h-[48px] items-center gap-2 rounded-xl border border-navy-100 bg-navy-50 px-4 text-sm font-semibold text-navy-900">
              <CircleDot className="h-4 w-4 text-emerald-600" />
              <span className="truncate">
                {user.stationName} ({user.stationCode})
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label htmlFor="destination" className="label">
              Assistance required at (destination)
            </label>
            <div className="relative">
              <select
                id="destination"
                className="input appearance-none pr-10"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                disabled={loadingStations}
                required
              >
                <option value="">{loadingStations ? "Loading stations…" : "Select destination station"}</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} ({station.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <span className="label">Number of passengers</span>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => adjustPassengers(-1)}
                disabled={passengers <= 1}
                className="flex w-12 items-center justify-center text-navy-800 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Decrease passengers"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div className="flex flex-1 flex-col items-center justify-center py-1">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={passengers}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) setPassengers(Math.min(30, Math.max(1, Math.round(value))));
                  }}
                  className="w-full border-0 bg-transparent p-0 text-center text-lg font-bold text-navy-950 focus:outline-none"
                  aria-label="Passenger count"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  passenger{passengers === 1 ? "" : "s"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustPassengers(1)}
                disabled={passengers >= 30}
                className="flex w-12 items-center justify-center text-navy-800 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Increase passengers"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="train-number" className="label">
              Train number
            </label>
            <div className="relative">
              <Ticket className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="train-number"
                className="input pl-11 uppercase"
                value={trainNumber}
                onChange={(event) => setTrainNumber(event.target.value.toUpperCase())}
                placeholder="e.g. 2890"
                maxLength={12}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="train-set" className="label">
              Train set number
            </label>
            <div className="relative">
              <TrainFront className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="train-set"
                className="input pl-11 uppercase"
                value={trainSet}
                onChange={(event) => setTrainSet(event.target.value.toUpperCase())}
                placeholder="e.g. 23"
                maxLength={12}
                required
              />
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="label">Circular direction</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["+", "-"] as Direction[]).map((dir) => (
              <label
                key={dir}
                className={`flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                  direction === dir
                    ? "border-navy-700 bg-navy-50"
                    : "border-slate-200 bg-white hover:border-navy-300"
                }`}
              >
                <input
                  type="radio"
                  name="direction"
                  value={dir}
                  checked={direction === dir}
                  onChange={() => setDirection(dir)}
                  className="h-5 w-5 accent-[#0b2447]"
                />
                <div>
                  <div className="text-base font-bold text-navy-950">{dir === "+" ? "+ Circular" : "- Circular"}</div>
                  <div className="text-[11px] text-slate-500">
                    {dir === "+" ? "Plus direction sequence" : "Minus direction sequence"}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {previewError ? <AlertBanner tone="warning">{previewError}</AlertBanner> : null}

        {preview ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <Route className="h-4 w-4" /> Route validated by {direction === "+" ? "+" : "-"} Circular sequence
              </div>
              <DirectionPill direction={direction} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-emerald-900">
              <span>
                <strong>{preview.distance}</strong> stations
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-4 w-4" /> approx. <strong>{preview.etaMinutes} min</strong> travel
              </span>
              <span>
                {user.stationName} <ArrowRight className="inline h-3.5 w-3.5" /> {destinationName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoute((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
            >
              {showRoute ? "Hide" : "View"} station sequence
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRoute ? "rotate-180" : ""}`} />
            </button>
            {showRoute ? (
              <ol className="mt-2 space-y-1 text-xs text-emerald-900/80">
                {preview.journey.map((station) => (
                  <li key={station.id} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-800">
                      {station.offset + 1}
                    </span>
                    {station.name}
                    {station.offset === 0 ? <span className="font-semibold">(boarding)</span> : null}
                    {station.offset === preview.distance ? <span className="font-semibold">(destination)</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {previewing ? <div className="mt-1 text-[11px] text-emerald-700">Updating preview…</div> : null}
          </div>
        ) : null}

        {error ? (
          <div>
            <AlertBanner tone="danger">{error}</AlertBanner>
            {errorList.length ? (
              <ul className="mt-2 list-inside list-disc rounded-lg bg-red-50 px-4 py-2 text-xs text-red-800">
                {errorList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Users className="mt-0.5 h-4 w-4 shrink-0" />
          Request IDs are generated automatically. The destination station receives a high-priority popup, alarm and
          push notification. Departure is only possible after their acknowledgement.
        </p>
      </form>
    </Modal>
  );
}
