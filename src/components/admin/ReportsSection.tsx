"use client";

import { useMemo, useState } from "react";
import { Clock3, Download, ListChecks, TrendingUp, Users } from "lucide-react";
import { EmptyState, StatCard, formatDateTime } from "@/components/ui";
import type { ReportPayload } from "@/lib/types";
import type { AdminApi } from "./admin-types";
import { SectionError, SectionHeader, SectionLoading, TableShell, EmptyRow } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

const RANGES = [
  ["daily", "Daily", "Last 14 days"],
  ["weekly", "Weekly", "Last 8 weeks"],
  ["monthly", "Monthly", "Last 6 months"],
] as const;

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function ReportsSection({ api }: { api: AdminApi }) {
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data, error, loading, reload } = useAdminData<ReportPayload>(
    `/api/admin/reports?range=${range}`,
    api.version
  );

  const maxSeries = useMemo(
    () => Math.max(1, ...(data?.series.map((point) => point.total) ?? [1])),
    [data]
  );

  function exportCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push("Metro Assist report");
    lines.push(`Range,${range}`);
    lines.push(`From,${data.from}`);
    lines.push(`To,${data.to}`);
    lines.push("");
    lines.push("Summary");
    lines.push("Total,Completed,Active,Visually Impaired,Wheelchair,Avg ack (min),Avg completion (min)");
    lines.push(
      [
        data.summary.total,
        data.summary.completed,
        data.summary.active,
        data.summary.visuallyImpaired,
        data.summary.wheelchair,
        data.summary.avgAckMinutes ?? "",
        data.summary.avgCompleteMinutes ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    lines.push("");
    lines.push("Station,Visually Impaired,Wheelchair,Total,Completed,Pending,Avg ack (min),Avg completion (min)");
    for (const row of data.stationWise) {
      lines.push(
        [
          csvCell(row.label),
          row.visuallyImpaired,
          row.wheelchair,
          row.total,
          row.completed,
          row.pending,
          row.avgAckMinutes ?? "",
          row.avgCompleteMinutes ?? "",
        ].join(",")
      );
    }
    lines.push("");
    lines.push("Period,Total,Completed,Visually Impaired,Wheelchair");
    for (const point of data.series) {
      lines.push([csvCell(point.label), point.total, point.completed, point.visuallyImpaired, point.wheelchair].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metro-assist-${range}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    api.notify("success", "Report CSV downloaded.");
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Reports & analytics"
        description="Request volumes, station-wise breakdown, assistance types and average acknowledgement and completion times."
        actions={
          <>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {RANGES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    range === value ? "bg-metro-navy text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={exportCsv} disabled={!data} className="btn-primary btn-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      {error ? (
        <SectionError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SectionLoading label="Building report…" />
      ) : !data ? null : (
        <>
          <p className="text-xs text-slate-500">
            {RANGES.find(([value]) => value === data.range)?.[2]}: {formatDateTime(data.from)} →{" "}
            {formatDateTime(data.to)} IST
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total requests"
              value={data.summary.total}
              icon={<ListChecks className="h-5 w-5" />}
              tone="navy"
              hint="In selected range"
            />
            <StatCard
              label="Completed"
              value={data.summary.completed}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="green"
              hint={`${data.summary.active} still active`}
            />
            <StatCard
              label="Visually Impaired"
              value={data.summary.visuallyImpaired}
              icon={<Users className="h-5 w-5" />}
              tone="sky"
              hint="Assistance requests"
            />
            <StatCard
              label="Wheelchair"
              value={data.summary.wheelchair}
              icon={<Users className="h-5 w-5" />}
              tone="violet"
              hint="Assistance requests"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-value">
                  {data.summary.avgAckMinutes == null ? "—" : `${data.summary.avgAckMinutes} min`}
                </div>
                <div className="stat-label">Average acknowledgement time</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-value">
                  {data.summary.avgCompleteMinutes == null ? "—" : `${data.summary.avgCompleteMinutes} min`}
                </div>
                <div className="stat-label">Average completion time</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <section className="card p-4">
              <h3 className="text-sm font-bold text-navy-950">Requests over time</h3>
              <p className="text-xs text-slate-500">Total requests per period; completed shown alongside.</p>
              <div className="mt-4 space-y-2.5">
                {data.series.map((point) => (
                  <div key={point.label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-slate-500">{point.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-metro-navy" style={{ width: `${(point.total / maxSeries) * 100}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right font-semibold text-navy-900">
                      {point.total} / {point.completed}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">Total / completed per period.</p>
            </section>

            <section className="card p-4">
              <h3 className="text-sm font-bold text-navy-950">Assistance mix</h3>
              <p className="text-xs text-slate-500">Visually Impaired vs Wheelchair requests in range.</p>
              {data.summary.total === 0 ? (
                <EmptyState title="No requests in this range" />
              ) : (
                <>
                  <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="bg-sky-500"
                      style={{ width: `${(data.summary.visuallyImpaired / data.summary.total) * 100}%` }}
                    />
                    <div
                      className="bg-violet-500"
                      style={{ width: `${(data.summary.wheelchair / data.summary.total) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <span className="h-2 w-2 rounded-full bg-sky-500" /> Visually Impaired · {data.summary.visuallyImpaired}
                    </span>
                    <span className="inline-flex items-center gap-1 text-violet-700">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> Wheelchair · {data.summary.wheelchair}
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-navy-950">Station-wise report</h3>
            {data.stationWise.length === 0 ? (
              <div className="card">
                <EmptyState title="No station activity in this range" />
              </div>
            ) : (
              <TableShell>
                <table className="data-table min-w-[880px]">
                  <thead>
                    <tr>
                      <th className="th">Boarding station</th>
                      <th className="th">VI</th>
                      <th className="th">WC</th>
                      <th className="th">Total</th>
                      <th className="th">Completed</th>
                      <th className="th">Pending</th>
                      <th className="th">Avg ack</th>
                      <th className="th">Avg completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stationWise.length ? (
                      data.stationWise.map((row) => (
                        <tr key={row.key}>
                          <td className="td font-semibold text-navy-950">{row.label}</td>
                          <td className="td">{row.visuallyImpaired}</td>
                          <td className="td">{row.wheelchair}</td>
                          <td className="td font-bold">{row.total}</td>
                          <td className="td text-emerald-700">{row.completed}</td>
                          <td className="td text-amber-700">{row.pending}</td>
                          <td className="td text-xs">{row.avgAckMinutes == null ? "—" : `${row.avgAckMinutes} min`}</td>
                          <td className="td text-xs">
                            {row.avgCompleteMinutes == null ? "—" : `${row.avgCompleteMinutes} min`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={8}>No station activity.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </TableShell>
            )}
          </section>
        </>
      )}
    </div>
  );
}
