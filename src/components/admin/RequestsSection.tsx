"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Eye, Filter, Search, X } from "lucide-react";
import {
  DirectionPill,
  EmptyState,
  Modal,
  Spinner,
  StatusBadge,
  TypePill,
  formatDateTime,
} from "@/components/ui";
import type { AssistanceRequest } from "@/lib/types";
import type { AdminApi, AdminStation } from "./admin-types";
import { EmptyRow, SectionError, SectionHeader, SectionLoading, TableShell } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

const STATUSES = [
  ["", "All statuses"],
  ["PENDING", "Pending"],
  ["ACKNOWLEDGED", "Acknowledged"],
  ["DEPARTED", "Train departed"],
  ["IN_TRANSIT", "In transit"],
  ["ARRIVED", "Arrived"],
  ["COMPLETED", "Completed"],
] as const;

export default function RequestsSection({ api }: { api: AdminApi }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [stationId, setStationId] = useState("");
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const stationsQuery = useAdminData<{ stations: AdminStation[] }>("/api/admin/stations", api.version);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (stationId) params.set("stationId", stationId);
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    const query = params.toString();
    return `/api/admin/requests${query ? `?${query}` : ""}`;
  }, [status, type, stationId, deferredSearch]);

  const { data, error, loading, reload } = useAdminData<{ requests: AssistanceRequest[] }>(url, api.version);

  const stationOptions = useMemo(
    () => [...(stationsQuery.data?.stations ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [stationsQuery.data]
  );

  const filtersActive = !!(search || status || type || stationId);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Assistance request register"
        description="Read-only monitoring of every request, including current train position, movement history and staff acknowledgements."
      />

      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="w-full lg:max-w-xs">
            <label htmlFor="request-search" className="label">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="request-search"
                className="input min-h-[42px] pl-9"
                placeholder="Request ID, train, station"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="w-full lg:w-40">
            <label htmlFor="request-status" className="label">
              Status
            </label>
            <select id="request-status" className="input min-h-[42px]" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-40">
            <label htmlFor="request-type" className="label">
              Type
            </label>
            <select id="request-type" className="input min-h-[42px]" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              <option value="VISUALLY_IMPAIRED">Visually Impaired</option>
              <option value="WHEELCHAIR">Wheelchair</option>
            </select>
          </div>
          <div className="w-full lg:w-56">
            <label htmlFor="request-station" className="label">
              Station
            </label>
            <select
              id="request-station"
              className="input min-h-[42px]"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
            >
              <option value="">All stations</option>
              {stationOptions.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.code})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
              setType("");
              setStationId("");
            }}
            disabled={!filtersActive}
            className="btn-outline btn-sm min-h-[42px] bg-white"
          >
            {filtersActive ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            Clear
          </button>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {data?.requests.length ?? 0} request(s)
          </div>
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SectionLoading label="Loading request register…" />
      ) : (data?.requests.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            title="No requests match"
            description="Adjust the filters, or wait for stations to create assistance requests."
          />
        </div>
      ) : (
        <TableShell>
          <table className="data-table min-w-[1080px]">
            <thead>
              <tr>
                <th className="th">Request</th>
                <th className="th">Status</th>
                <th className="th">Route</th>
                <th className="th">Assistance</th>
                <th className="th">Train</th>
                <th className="th">Pax</th>
                <th className="th">Position</th>
                <th className="th">Created</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.requests.map((request) => (
                <tr key={request.requestCode}>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => setDetailCode(request.requestCode)}
                      className="font-mono text-xs font-bold text-navy-800 hover:underline"
                    >
                      {request.requestCode}
                    </button>
                  </td>
                  <td className="td">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="td text-xs">
                    <div className="font-semibold text-navy-900">{request.boardingStation}</div>
                    <div className="text-slate-500">→ {request.destinationStation}</div>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      <TypePill type={request.assistanceType} />
                      <DirectionPill direction={request.direction} />
                    </div>
                  </td>
                  <td className="td text-xs">
                    <div className="font-semibold">{request.trainNumber}</div>
                    <div className="text-slate-500">Set {request.trainSet}</div>
                  </td>
                  <td className="td font-semibold">{request.passengerCount}</td>
                  <td className="td text-xs">
                    <div>{request.currentStation ?? "—"}</div>
                    <div className="text-slate-500">
                      {request.status === "COMPLETED" ? "Completed" : `${request.remainingStations} left`}
                    </div>
                  </td>
                  <td className="td text-xs text-slate-500">{formatDateTime(request.createdAt)}</td>
                  <td className="td">
                    <button type="button" onClick={() => setDetailCode(request.requestCode)} className="btn-outline btn-sm">
                      <Eye className="h-3.5 w-3.5" /> Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      {detailCode ? (
        <AdminRequestDetail code={detailCode} version={api.version} onClose={() => setDetailCode(null)} />
      ) : null}
    </div>
  );
}

function AdminRequestDetail({ code, version, onClose }: { code: string; version: number; onClose: () => void }) {
  const { data, error, loading, reload } = useAdminData<{ request: AssistanceRequest }>(
    `/api/admin/requests/${encodeURIComponent(code)}`,
    version
  );
  const request = data?.request;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request ${code}`}
      subtitle="Administrator monitoring view — station staff perform all field actions."
      size="xl"
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading && !request ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Spinner /> Loading request…
        </div>
      ) : error ? (
        <SectionError message={error} onRetry={reload} />
      ) : request ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <TypePill type={request.assistanceType} />
            <DirectionPill direction={request.direction} />
            <span className="text-xs text-slate-500">
              Created {formatDateTime(request.createdAt, true)} by {request.createdBy}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Boarding", request.boardingStation],
              ["Destination", request.destinationStation],
              ["Train / set", `${request.trainNumber} / ${request.trainSet}`],
              ["Passengers", String(request.passengerCount)],
              ["Current station", request.currentStation ?? "—"],
              ["Remaining", request.status === "COMPLETED" ? "0" : String(request.remainingStations)],
              ["Acknowledged", request.acknowledgedAt ? formatDateTime(request.acknowledgedAt) : "Pending"],
              ["Completed", request.completedAt ? formatDateTime(request.completedAt) : "Pending"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-0.5 text-sm font-semibold text-navy-950">{value}</div>
              </div>
            ))}
          </div>

          {request.journey?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Journey progress</h3>
              <div className="scrollbar-thin flex gap-1 overflow-x-auto pb-1">
                {request.journey.map((station) => (
                  <div
                    key={station.id}
                    className={`min-w-[120px] shrink-0 rounded-xl border px-3 py-2 text-xs ${
                      station.offset === request.currentOffset
                        ? "border-navy-700 bg-navy-50 font-bold text-navy-950"
                        : station.offset < request.currentOffset
                          ? "border-slate-200 bg-slate-50 text-slate-500"
                          : "border-slate-200 bg-white text-navy-900"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-slate-400">Stop {station.offset + 1}</div>
                    <div className="truncate">{station.name}</div>
                    {station.isBoarding ? <div className="text-[10px] text-emerald-700">Boarding</div> : null}
                    {station.isDestination ? <div className="text-[10px] text-metro-red">Destination</div> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Status timeline</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                ["Created", request.createdAt],
                ["Acknowledged", request.acknowledgedAt],
                ["Departed", request.departedAt],
                ["Arrived", request.arrivedAt],
                ["Completed", request.completedAt],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-600">{label}</span>
                  <span className={value ? "font-semibold text-navy-900" : "text-slate-400"}>
                    {value ? formatDateTime(value, true) : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Movement history</h3>
            {request.movements?.length ? (
              <div className="scrollbar-thin max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                <table className="data-table min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="th">Station</th>
                      <th className="th">Offset</th>
                      <th className="th">Updated by</th>
                      <th className="th">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="td">{movement.stationName}</td>
                        <td className="td">{movement.offset}</td>
                        <td className="td">{movement.updatedBy}</td>
                        <td className="td text-xs">{formatDateTime(movement.createdAt, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No train movement recorded yet.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Acknowledgements</h3>
            {request.acknowledgements?.length ? (
              <ul className="space-y-1.5">
                {request.acknowledgements.map((ack) => (
                  <li key={`${ack.action}-${ack.createdAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-navy-900">
                      {ack.action === "ACKNOWLEDGED" ? "Destination acknowledgement" : "Assistance completed"} ·{" "}
                      {ack.stationName}
                    </span>
                    <span className="text-slate-500">
                      {ack.userName} · {formatDateTime(ack.createdAt, true)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No staff acknowledgement recorded yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
