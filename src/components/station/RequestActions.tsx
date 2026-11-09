"use client";

import { ArrowRight, Check, CheckCircle2, Eye, MapPin, Navigation, TrainFront, VolumeX } from "lucide-react";
import { Spinner } from "@/components/ui";
import type { AssistanceRequest } from "@/lib/types";
import type { StationApi } from "./station-types";

export default function RequestActions({
  request,
  stationId,
  busy,
  api,
  detailed = false,
}: {
  request: AssistanceRequest;
  stationId: number;
  busy: boolean;
  api: StationApi;
  detailed?: boolean;
}) {
  const isDestination = request.destinationStationId === stationId;
  const isBoarding = request.boardingStationId === stationId;
  const active = request.status !== "COMPLETED";
  const size = detailed ? "btn" : "btn-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isDestination && request.status === "PENDING" ? (
        <>
          <button type="button" onClick={() => api.acknowledge(request.requestCode)} disabled={busy} className={`btn-yellow ${size}`}>
            {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            Acknowledge
          </button>
          <button
            type="button"
            onClick={() => api.silence(request.requestCode)}
            disabled={busy}
            className={`btn-outline ${size}`}
            title="Silence the alarm without acknowledging"
          >
            <VolumeX className="h-4 w-4" /> Silence
          </button>
        </>
      ) : null}

      {isBoarding && request.status === "ACKNOWLEDGED" ? (
        <button type="button" onClick={() => api.depart(request.requestCode)} disabled={busy} className={`btn-primary ${size}`}>
          {busy ? <Spinner className="h-4 w-4" /> : <TrainFront className="h-4 w-4" />}
          Train departed
        </button>
      ) : null}

      {isBoarding && (request.status === "DEPARTED" || request.status === "IN_TRANSIT") ? (
        <button
          type="button"
          onClick={() => api.openLocationUpdate(request.requestCode)}
          disabled={busy}
          className={`btn-primary ${size}`}
        >
          {busy ? <Spinner className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
          Update location
        </button>
      ) : null}

      {isDestination && request.status === "ARRIVED" ? (
        <button type="button" onClick={() => api.complete(request.requestCode)} disabled={busy} className={`btn-success ${size}`}>
          {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          Assistance provided
        </button>
      ) : null}

      {isDestination && (request.status === "DEPARTED" || request.status === "IN_TRANSIT") ? (
        <button
          type="button"
          onClick={() => api.openDetail(request.requestCode)}
          className={`btn-outline ${size}`}
          title="View train progress"
        >
          <MapPin className="h-4 w-4" /> Track train
        </button>
      ) : null}

      {active && !(isDestination && request.status === "PENDING") ? (
        <button type="button" onClick={() => api.openDetail(request.requestCode)} className={`btn-ghost ${size}`}>
          <Eye className="h-4 w-4" /> Details
          <ArrowRight className="hidden h-3.5 w-3.5 sm:inline" />
        </button>
      ) : null}

      {!active ? (
        <button type="button" onClick={() => api.openDetail(request.requestCode)} className={`btn-ghost ${size}`}>
          <Eye className="h-4 w-4" /> View record
        </button>
      ) : null}
    </div>
  );
}
