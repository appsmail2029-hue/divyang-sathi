"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { EmptyState, Spinner, formatDateTime } from "@/components/ui";
import type { AuditLog } from "@/lib/types";
import type { AdminApi } from "./admin-types";
import { SectionError, SectionHeader, SectionLoading, TableShell, EmptyRow } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

function tone(action: string) {
  if (/FAILED|ALARM|DELETED/.test(action)) return "bg-red-100 text-red-800";
  if (/LOGIN|LOGOUT/.test(action)) return "bg-sky-100 text-sky-800";
  if (/CREATED|IMPORT|COMPLETED|ACKNOWLEDGED|PASSWORD_RESET/.test(action)) return "bg-emerald-100 text-emerald-800";
  if (/UPDATED|MOVED|DEPARTED|ARRIVED|TRIGGERED|CLOSED/.test(action)) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export default function AuditSection({ api }: { api: AdminApi }) {
  const [limit, setLimit] = useState(250);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const { data, error, loading, reload } = useAdminData<{ logs: AuditLog[] }>(
    `/api/admin/audit?limit=${limit}`,
    api.version
  );

  const actions = useMemo(() => {
    const unique = new Set((data?.logs ?? []).map((log) => log.action));
    return Array.from(unique).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.logs ?? []).filter((log) => {
      if (action && log.action !== action) return false;
      if (!term) return true;
      return (
        log.actorName.toLowerCase().includes(term) ||
        (log.stationName ?? "").toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        (log.details ?? "").toLowerCase().includes(term) ||
        (log.entityId ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, search, action]);

  function exportCsv() {
    const lines = ["Time,Actor,Station,Action,Entity,Entity ID,Details"];
    for (const log of filtered) {
      const cells = [log.createdAt, log.actorName, log.stationName ?? "", log.action, log.entity, log.entityId ?? "", log.details ?? ""];
      lines.push(
        cells
          .map((value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value))
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metro-assist-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    api.notify("success", "Audit CSV downloaded.");
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Audit log"
        description="Every login, request transition, movement, notice and administrative change is recorded server-side."
        actions={
          <>
            <button type="button" onClick={() => api.refresh()} className="btn-outline btn-sm bg-white">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={exportCsv} disabled={!filtered.length} className="btn-primary btn-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input min-h-[42px] pl-9"
              placeholder="Search actor, station, action or details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search audit log"
            />
          </div>
          <select
            className="input min-h-[42px] sm:w-60"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {loading ? <Spinner className="h-4 w-4" /> : null}
          {filtered.length} of {data?.logs.length ?? 0} entries
          {limit < 500 ? (
            <button type="button" onClick={() => setLimit(500)} className="font-semibold text-navy-700 underline">
              Load 500
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SectionLoading label="Loading audit trail…" />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState title="No audit entries match" description="Try clearing the search or action filter." />
        </div>
      ) : (
        <TableShell>
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th className="th">Time</th>
                <th className="th">Actor</th>
                <th className="th">Station</th>
                <th className="th">Action</th>
                <th className="th">Entity</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="td whitespace-nowrap text-xs text-slate-500">{formatDateTime(log.createdAt, true)}</td>
                    <td className="td text-sm font-semibold text-navy-900">{log.actorName}</td>
                    <td className="td text-xs text-slate-500">{log.stationName ?? "—"}</td>
                    <td className="td">
                      <span className={`chip ${tone(log.action)}`}>{log.action.replaceAll("_", " ")}</span>
                    </td>
                    <td className="td text-xs text-slate-500">
                      {log.entity}
                      {log.entityId ? <span className="ml-1 font-mono text-slate-400">#{log.entityId}</span> : null}
                    </td>
                    <td className="td max-w-[360px] text-xs text-slate-600">{log.details ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={6}>No entries.</EmptyRow>
              )}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
