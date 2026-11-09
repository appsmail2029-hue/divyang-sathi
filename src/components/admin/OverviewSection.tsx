"use client";

import {
  Activity,
  Building2,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  DirectionPill,
  EmptyState,
  StatCard,
  StatusBadge,
  TypePill,
  formatDateTime,
  relativeTime,
} from "@/components/ui";
import type { AdminOverview } from "@/lib/types";
import { useAdminData } from "./use-admin-data";
import { SectionError, SectionHeader, SectionLoading, TableShell, EmptyRow } from "./admin-ui";
import type { AdminApi } from "./admin-types";

export default function OverviewSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<AdminOverview>("/api/admin/overview", api.version);

  if (loading && !data) return <SectionLoading label="Loading administrator overview…" />;
  if (error) return <SectionError message={error} onRetry={reload} />;
  if (!data) return null;

  const totalDirection = Math.max(1, data.directionSummary.plus + data.directionSummary.minus);
  const plusShare = Math.round((data.directionSummary.plus / totalDirection) * 100);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Network overview"
        description="Live operational picture across every configured station, account and assistance request."
        actions={
          <>
            <button type="button" onClick={() => api.setTab("reports")} className="btn-outline btn-sm bg-white">
              Open reports
            </button>
            <button type="button" onClick={() => api.setTab("requests")} className="btn-primary btn-sm">
              Request register
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active stations"
          value={`${data.stations.active}/${data.stations.total}`}
          icon={<Building2 className="h-5 w-5" />}
          tone="navy"
          hint="Stations available for requests"
        />
        <StatCard
          label="Active accounts"
          value={`${data.users.active}/${data.users.total}`}
          icon={<Users className="h-5 w-5" />}
          tone="sky"
          hint={`${data.users.admins} administrator(s)`}
        />
        <StatCard
          label="Requests today"
          value={data.requests.today}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="violet"
          hint={`${data.requests.total} recorded in total`}
        />
        <StatCard
          label="Active requests"
          value={data.requests.active}
          icon={<Activity className="h-5 w-5" />}
          tone="amber"
          hint="Not yet completed"
        />
        <StatCard
          label="Pending acknowledgement"
          value={data.requests.pending}
          icon={<TriangleAlert className="h-5 w-5" />}
          tone="red"
          hint="Destination action required"
        />
        <StatCard
          label="Completed requests"
          value={data.requests.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          hint="Assistance provided"
        />
        <StatCard
          label="Open notices"
          value={data.info.open}
          icon={<Megaphone className="h-5 w-5" />}
          tone="amber"
          hint={`${data.info.total} broadcast in total`}
        />
        <StatCard
          label="Administrators"
          value={data.users.admins}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="navy"
          hint="Accounts with full access"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Latest assistance requests</h3>
              <p className="text-xs text-slate-500">Newest across the whole network</p>
            </div>
            <button type="button" onClick={() => api.setTab("requests")} className="text-xs font-semibold text-navy-700 hover:underline">
              View all
            </button>
          </div>
          {data.recentRequests.length ? (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th className="th">Request</th>
                    <th className="th">Status</th>
                    <th className="th">Route</th>
                    <th className="th">Train</th>
                    <th className="th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRequests.map((request) => (
                    <tr key={request.requestCode}>
                      <td className="td">
                        <div className="font-bold text-navy-950">{request.requestCode}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <TypePill type={request.assistanceType} />
                          <DirectionPill direction={request.direction} />
                        </div>
                      </td>
                      <td className="td">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="td text-xs">
                        <div className="font-semibold text-navy-900">{request.boardingStation}</div>
                        <div className="text-slate-500">→ {request.destinationStation}</div>
                      </td>
                      <td className="td text-xs">
                        <div className="font-semibold">{request.trainNumber}</div>
                        <div className="text-slate-500">Set {request.trainSet}</div>
                      </td>
                      <td className="td text-xs text-slate-500">{formatDateTime(request.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No requests yet" description="Assistance requests created by stations will appear here." />
          )}
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="text-sm font-bold text-navy-950">Direction split</h3>
            <p className="text-xs text-slate-500">Share of recorded requests by circular direction</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-emerald-500" style={{ width: `${plusShare}%` }} />
              <div className="bg-orange-400" style={{ width: `${100 - plusShare}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-semibold text-slate-600">
              <span>+ Circular · {data.directionSummary.plus}</span>
              <span>- Circular · {data.directionSummary.minus}</span>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-navy-950">Recent audit activity</h3>
                <p className="text-xs text-slate-500">Newest system events</p>
              </div>
              <button type="button" onClick={() => api.setTab("audit")} className="text-xs font-semibold text-navy-700 hover:underline">
                Audit log
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {data.recentAudit.length ? (
                data.recentAudit.map((log) => (
                  <li key={log.id} className="px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-navy-900">{log.action.replaceAll("_", " ")}</span>
                      <span className="shrink-0 text-slate-400">{relativeTime(log.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {log.actorName}
                      {log.stationName ? ` · ${log.stationName}` : ""}
                    </div>
                    {log.details ? <div className="mt-0.5 line-clamp-2 text-slate-500">{log.details}</div> : null}
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-xs text-slate-500">No audit entries yet.</li>
              )}
            </ul>
          </section>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-navy-950">Direction summary table</h3>
          <p className="text-xs text-slate-500">Confirmed request counts used by the reports module</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th className="th">Direction</th>
              <th className="th">Requests</th>
              <th className="th">Share</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="td">
                <DirectionPill direction="+" />
              </td>
              <td className="td font-semibold">{data.directionSummary.plus}</td>
              <td className="td">{plusShare}%</td>
            </tr>
            <tr>
              <td className="td">
                <DirectionPill direction="-" />
              </td>
              <td className="td font-semibold">{data.directionSummary.minus}</td>
              <td className="td">{100 - plusShare}%</td>
            </tr>
            <EmptyRow colSpan={3}>Totals combine live and historical requests.</EmptyRow>
          </tbody>
        </table>
      </section>
    </div>
  );
}
