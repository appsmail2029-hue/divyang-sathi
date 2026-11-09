"use client";

import { useMemo, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  Eye,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  TrainFront,
  X,
} from "lucide-react";
import {
  DirectionPill,
  EmptyState,
  StatusBadge,
  TypePill,
  cn,
  formatDateTime,
} from "@/components/ui";
import type {
  AssistanceRequest,
  AssistanceType,
  DashboardData,
  Direction,
  RequestStatus,
  SessionUser,
} from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import RequestActions from "./RequestActions";
import type { StationApi } from "./station-types";

const STATUSES: Array<RequestStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "ACKNOWLEDGED",
  "DEPARTED",
  "IN_TRANSIT",
  "ARRIVED",
  "COMPLETED",
];

export default function RequestsTab({
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
  const [status, setStatus] = useState<RequestStatus | "ALL">("ALL");
  const [type, setType] = useState<AssistanceType | "ALL">("ALL");
  const [direction, setDirection] = useState<Direction | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.requests.filter((request) => {
      if (status !== "ALL" && request.status !== status) return false;
      if (type !== "ALL" && request.assistanceType !== type) return false;
      if (direction !== "ALL" && request.direction !== direction) return false;
      if (!term) return true;
      return [
        request.requestCode,
        request.boardingStation,
        request.destinationStation,
        request.trainNumber,
        request.trainSet,
        request.currentStation || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data.requests, status, type, direction, query]);

  const activeFilters = (status !== "ALL" ? 1 : 0) + (type !== "ALL" ? 1 : 0) + (direction !== "ALL" ? 1 : 0) + (query ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-navy-950">Assistance requests</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {data.requests.length} request(s) linked to {user.stationName}. Only the boarding station can manage departure and movement;
              only the destination station can acknowledge and complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={() => api.openRequestForm("VISUALLY_IMPAIRED")}>
              <Eye className="h-4 w-4" /> Visually impaired
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => api.openRequestForm("WHEELCHAIR")}>
              <Accessibility className="h-4 w-4" /> Wheelchair
            </button>
            <button type="button" className="btn-yellow btn-sm" onClick={() => api.openInfo()}>
              <Plus className="h-4 w-4" /> New notice
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search request ID, station, train…"
              className="input pl-10"
              aria-label="Search requests"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Select
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as RequestStatus | "ALL")}
            options={STATUSES.map((item) => ({ value: item, label: item === "ALL" ? "All statuses" : STATUS_LABEL[item] }))}
          />
          <Select
            label="Type"
            value={type}
            onChange={(value) => setType(value as AssistanceType | "ALL")}
            options={[
              { value: "ALL", label: "All types" },
              { value: "VISUALLY_IMPAIRED", label: "Visually Impaired" },
              { value: "WHEELCHAIR", label: "Wheelchair" },
            ]}
          />
          <Select
            label="Direction"
            value={direction}
            onChange={(value) => setDirection(value as Direction | "ALL")}
            options={[
              { value: "ALL", label: "Both directions" },
              { value: "+", label: "+ Circular" },
              { value: "-", label: "- Circular" },
            ]}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Showing {filtered.length} of {data.requests.length}
          {activeFilters ? (
            <button
              type="button"
              onClick={() => {
                setStatus("ALL");
                setType("ALL");
                setDirection("ALL");
                setQuery("");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-200"
            >
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"} <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table hidden lg:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Request</th>
                  <th className="th">Route & direction</th>
                  <th className="th">Assistance</th>
                  <th className="th">Train</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((request) => (
                  <tr key={request.requestCode}>
                    <td className="td">
                      <button
                        type="button"
                        onClick={() => api.openDetail(request.requestCode)}
                        className="font-mono text-xs font-bold text-navy-800 underline decoration-slate-300 underline-offset-2 hover:text-navy-950"
                      >
                        {request.requestCode}
                      </button>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {request.boardingStationId === user.stationId ? "Boarding station" : "Destination station"}
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1 text-sm font-semibold text-navy-900">
                        <span className="max-w-[130px] truncate">{request.boardingStation}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="max-w-[130px] truncate">{request.destinationStation}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <DirectionPill direction={request.direction} />
                        <span className="chip bg-slate-100 text-slate-600">{request.totalStations} stations</span>
                      </div>
                    </td>
                    <td className="td">
                      <TypePill type={request.assistanceType} />
                      <div className="mt-0.5 text-[11px] text-slate-500">{request.passengerCount} passenger(s)</div>
                    </td>
                    <td className="td">
                      <div className="text-sm font-semibold text-navy-900">{request.trainNumber}</div>
                      <div className="text-[11px] text-slate-500">Set {request.trainSet}</div>
                    </td>
                    <td className="td">
                      <StatusBadge status={request.status} />
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {request.status === "COMPLETED"
                          ? formatDateTime(request.completedAt)
                          : request.currentStation
                            ? `${request.currentStation} · ${request.remainingStations} left`
                            : "Awaiting acknowledgement"}
                      </div>
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-500">{formatDateTime(request.createdAt)}</td>
                    <td className="td">
                      <div className="flex justify-end">
                        <RequestActions request={request} stationId={user.stationId!} busy={busyCode === request.requestCode} api={api} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filtered.map((request) => (
                <RequestCard
                  key={request.requestCode}
                  request={request}
                  stationId={user.stationId!}
                  busy={busyCode === request.requestCode}
                  api={api}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Filter className="h-10 w-10" />}
            title="No requests match these filters"
            description="Adjust the status, type or direction filters to see other requests."
            action={
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setStatus("ALL");
                  setType("ALL");
                  setDirection("ALL");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        className="input min-h-[48px] bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RequestCard({
  request,
  stationId,
  busy,
  api,
}: {
  request: AssistanceRequest;
  stationId: number;
  busy: boolean;
  api: StationApi;
}) {
  return (
    <div className={cn("px-4 py-3", request.status !== "COMPLETED" && "bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => api.openDetail(request.requestCode)}
          className="font-mono text-xs font-bold text-navy-800 underline decoration-slate-300 underline-offset-2"
        >
          {request.requestCode}
        </button>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-1 text-sm font-semibold text-navy-950">
        {request.boardingStation} <span className="text-slate-400">→</span> {request.destinationStation}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <TypePill type={request.assistanceType} />
        <DirectionPill direction={request.direction} />
        <span className="chip bg-slate-100 text-slate-600">
          <TrainFront className="h-3 w-3" /> {request.trainNumber}/{request.trainSet}
        </span>
        <span className="chip bg-slate-100 text-slate-600">{request.passengerCount} pax</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {request.status === "COMPLETED"
          ? `Completed ${formatDateTime(request.completedAt)}`
          : request.currentStation
            ? `${request.currentStation} · ${request.remainingStations} station(s) remaining`
            : "Awaiting destination acknowledgement"}
      </div>
      <div className="mt-2">
        <RequestActions request={request} stationId={stationId} busy={busy} api={api} />
      </div>
    </div>
  );
}
