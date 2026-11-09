"use client";

import {
  Accessibility,
  AlarmClock,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Megaphone,
  Siren,
  TrainFront,
  TrendingUp,
} from "lucide-react";
import {
  CategoryPill,
  EmptyState,
  DirectionPill,
  StatCard,
  StatusBadge,
  TypePill,
  cn,
  formatDay,
  formatTime,
  relativeTime,
  useNow,
} from "@/components/ui";
import type { AssistanceRequest, DashboardData, SessionUser } from "@/lib/types";
import RequestActions from "./RequestActions";
import type { StationApi } from "./station-types";

export default function OverviewTab({
  user,
  data,
  api,
  busyCode,
  onAckInfo,
}: {
  user: SessionUser;
  data: DashboardData;
  api: StationApi;
  busyCode: string | null;
  onAckInfo: (infoCode: string) => void;
}) {
  const now = useNow(30_000);
  const active = data.requests.filter((request) => request.status !== "COMPLETED");
  const approaches = active
    .filter(
      (request) =>
        request.destinationStationId === user.stationId &&
        (request.status === "DEPARTED" || request.status === "IN_TRANSIT") &&
        request.remainingStations <= 3
    )
    .sort((a, b) => a.remainingStations - b.remainingStations);

  const recentNotices = data.notices.filter((notice) => notice.status === "OPEN").slice(0, 3);

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="surface-navy px-5 py-5 text-white sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-metro-yellow">
                Station command centre
              </div>
              <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{user.stationName}</h2>
              <p className="mt-1 text-sm text-white/70">
                {formatDay(data.serverTime)} · {data.settings.organizationName} · {user.stationCode} · Signed in as {user.displayName}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5">
              <Clock className="h-8 w-8 text-metro-yellow" />
              <div>
                <div className="text-lg font-extrabold leading-none">{formatTime(data.serverTime)}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">IST live clock</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => api.openRequestForm("VISUALLY_IMPAIRED")}
          className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-left shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white">
            <Eye className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-lg font-extrabold text-navy-950">VISUALLY IMPAIRED</span>
            <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-sky-700">
              Create assistance request <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => api.openRequestForm("WHEELCHAIR")}
          className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 text-left shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Accessibility className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-lg font-extrabold text-navy-950">WHEELCHAIR</span>
            <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-violet-700">
              Create assistance request <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => api.openInfo()}
          className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Megaphone className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-lg font-extrabold text-navy-950">OTHER INFORMATION</span>
            <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-amber-700">
              Broadcast to all stations <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </button>
      </div>

      {approaches.length ? (
        <div className="overflow-hidden rounded-2xl border-2 border-red-300 bg-red-50 shadow-card">
          <div className="flex items-center gap-2 bg-red-600 px-4 py-2 text-white">
            <Siren className="h-5 w-5 animate-blink" />
            <span className="text-xs font-extrabold uppercase tracking-widest">Train approaching — prepare assistance</span>
          </div>
          <div className="divide-y divide-red-100">
            {approaches.map((request) => (
              <button
                key={request.requestCode}
                type="button"
                onClick={() => api.openDetail(request.requestCode)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-red-100/60"
              >
                <TrainFront className="h-5 w-5 text-red-700" />
                <span className="font-mono text-xs font-bold text-red-900">{request.requestCode}</span>
                <span className="text-sm font-bold text-red-950">
                  Train {request.trainNumber} / Set {request.trainSet}
                </span>
                <span className="text-sm text-red-900">
                  {request.passengerCount} passenger(s) · {request.assistanceType === "VISUALLY_IMPAIRED" ? "Visually Impaired" : "Wheelchair"}
                </span>
                <span className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-red-700">
                  <AlarmClock className="h-4 w-4" />
                  {request.remainingStations} station(s) · ETA {request.estimatedArrivalAt ? formatTime(request.estimatedArrivalAt) : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            <TrendingUp className="h-4 w-4" /> Station statistics
          </h2>
          <span className="text-[11px] text-slate-400">Updated {relativeTime(data.serverTime, now)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total requests" value={data.stats.totalRequests} icon={<ClipboardList className="h-5 w-5" />} tone="navy" />
          <StatCard label="Pending" value={data.stats.pending} icon={<BellRing className="h-5 w-5" />} tone="amber" />
          <StatCard label="Acknowledged" value={data.stats.acknowledged} icon={<CheckCircle2 className="h-5 w-5" />} tone="sky" />
          <StatCard label="Trains approaching" value={data.stats.approaching} icon={<TrainFront className="h-5 w-5" />} tone="violet" />
          <StatCard label="Completed" value={data.stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <StatCard label="Active notices" value={data.stats.activeNotices} icon={<Megaphone className="h-5 w-5" />} tone="red" />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Live assistance requests</h2>
            <p className="text-xs text-slate-500">Requests boarding or alighting at {user.stationName}</p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => api.openTab("requests")}>
            View all <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {active.length ? (
          <div className="overflow-x-auto">
            <table className="data-table hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Request</th>
                  <th className="th">Route</th>
                  <th className="th">Assistance</th>
                  <th className="th">Train</th>
                  <th className="th">Status</th>
                  <th className="th">Progress</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.slice(0, 10).map((request) => (
                  <tr key={request.requestCode}>
                    <td className="td">
                      <div className="font-mono text-xs font-bold text-navy-900">{request.requestCode}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{relativeTime(request.createdAt)}</div>
                    </td>
                    <td className="td">
                      <div className="max-w-[220px] text-sm font-semibold text-navy-900">
                        {request.boardingStation} <span className="text-slate-400">→</span> {request.destinationStation}
                      </div>
                      <div className="mt-0.5">
                        <DirectionPill direction={request.direction} />
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
                    </td>
                    <td className="td min-w-[140px]">
                      <Progress request={request} />
                    </td>
                    <td className="td">
                      <div className="flex justify-end">
                        <RequestActions
                          request={request}
                          stationId={user.stationId!}
                          busy={busyCode === request.requestCode}
                          api={api}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divide-y divide-slate-100 md:hidden">
              {active.slice(0, 10).map((request) => (
                <div key={request.requestCode} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-navy-900">{request.requestCode}</span>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-navy-950">
                    {request.boardingStation} → {request.destinationStation}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <TypePill type={request.assistanceType} />
                    <DirectionPill direction={request.direction} />
                    <span className="chip bg-slate-100 text-slate-600">
                      {request.passengerCount} pax · {request.trainNumber}/{request.trainSet}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Progress request={request} />
                  </div>
                  <div className="mt-2.5">
                    <RequestActions request={request} stationId={user.stationId!} busy={busyCode === request.requestCode} api={api} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="No active assistance requests"
            description="Create a Visually Impaired or Wheelchair request to notify the destination station immediately."
            action={
              <button type="button" className="btn-primary btn-sm" onClick={() => api.openRequestForm("VISUALLY_IMPAIRED")}>
                Create request
              </button>
            }
          />
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Notice board</h2>
            <p className="text-xs text-slate-500">Open information broadcasts across all {data.settings.organizationName} stations</p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => api.openTab("info")}>
            All notices <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {recentNotices.length ? (
          <div className="divide-y divide-slate-100">
            {recentNotices.map((notice) => (
              <div key={notice.infoCode} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryPill category={notice.category} />
                  <span className="font-mono text-[11px] font-bold text-slate-500">{notice.infoCode}</span>
                  <span className="text-[11px] text-slate-400">
                    {notice.originStation} · {relativeTime(notice.createdAt)}
                  </span>
                  {notice.acknowledgedByMe ? (
                    <span className="ml-auto chip bg-emerald-50 text-emerald-700">Received</span>
                  ) : (
                    <button
                      type="button"
                      className="ml-auto btn-yellow btn-sm"
                      onClick={() => onAckInfo(notice.infoCode)}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Acknowledge
                    </button>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-navy-900">{notice.description}</p>
                <div className="mt-1 text-[11px] text-slate-400">
                  {notice.acknowledgedStations} station(s) acknowledged
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Megaphone className="h-9 w-9" />}
            title="No active notices"
            description="Lost & Found, separate passenger and other information notices are broadcast to every active station."
            action={
              <button type="button" className="btn-primary btn-sm" onClick={() => api.openInfo()}>
                Broadcast information
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

function Progress({ request }: { request: AssistanceRequest }) {
  const total = Math.max(1, request.totalStations);
  const value = request.status === "PENDING" ? 0 : Math.min(100, Math.round((request.currentOffset / total) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>
          {request.currentStation || request.boardingStation}
        </span>
        <span>{request.status === "COMPLETED" ? "Done" : `${request.remainingStations} left`}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            "h-full rounded-full",
            request.status === "COMPLETED" ? "bg-emerald-500" : "bg-navy-700"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      {request.status === "DEPARTED" || request.status === "IN_TRANSIT" ? (
        <div className="mt-0.5 text-[10px] text-slate-400">
          {request.estimatedArrivalAt ? `ETA ${formatTime(request.estimatedArrivalAt)}` : "In transit"}
        </div>
      ) : null}
    </div>
  );
}
