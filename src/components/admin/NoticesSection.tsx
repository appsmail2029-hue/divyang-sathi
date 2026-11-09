"use client";

import { useMemo, useState } from "react";
import { Archive, CheckCheck, Search } from "lucide-react";
import { CategoryPill, EmptyState, Spinner, formatDateTime, relativeTime } from "@/components/ui";
import { errorMessage, postJson } from "@/lib/client-api";
import { INFO_LABEL } from "@/lib/types";
import type { AdminApi, AdminNotice } from "./admin-types";
import { SectionError, SectionHeader, SectionLoading } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

export default function NoticesSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<{ notices: AdminNotice[] }>("/api/admin/info", api.version);
  const [view, setView] = useState<"open" | "all">("open");
  const [query, setQuery] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.notices ?? []).filter((notice) => {
      if (view === "open" && notice.status !== "OPEN") return false;
      if (!term) return true;
      return (
        notice.infoCode.toLowerCase().includes(term) ||
        notice.description.toLowerCase().includes(term) ||
        notice.originStation.toLowerCase().includes(term) ||
        INFO_LABEL[notice.category].toLowerCase().includes(term)
      );
    });
  }, [data, view, query]);

  const openCount = (data?.notices ?? []).filter((notice) => notice.status === "OPEN").length;

  async function closeNotice(notice: AdminNotice) {
    if (!window.confirm(`Close notice ${notice.infoCode}? It will leave the active board at every station.`)) return;
    setBusyCode(notice.infoCode);
    try {
      await postJson(`/api/admin/info/${encodeURIComponent(notice.infoCode)}/close`);
      api.notify("success", `Notice ${notice.infoCode} closed.`);
      api.refresh();
    } catch (err) {
      api.notify("error", errorMessage(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Information & notices"
        description="Network-wide Lost & Found, separate passenger and other notices created by stations. Administrators close notices once resolved."
        actions={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["open", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  view === value ? "bg-metro-navy text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {value === "open" ? `Open (${openCount})` : `All (${data?.notices.length ?? 0})`}
              </button>
            ))}
          </div>
        }
      />

      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input min-h-[42px] pl-9"
          placeholder="Search notice ID, text or origin"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search notices"
        />
      </div>

      {error ? (
        <SectionError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SectionLoading label="Loading notices…" />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title={view === "open" ? "No open notices" : "No notices yet"}
            description="Station broadcasts appear here for monitoring and closure."
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((notice) => (
            <article key={notice.infoCode} className="card overflow-hidden">
              {notice.imageUrl ? (
                <img src={notice.imageUrl} alt="Notice attachment" className="h-36 w-full object-cover" />
              ) : null}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryPill category={notice.category} />
                  <span
                    className={`chip ${
                      notice.status === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {notice.status === "OPEN" ? "Open" : "Closed"}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-500">{notice.infoCode}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{relativeTime(notice.createdAt)}</span>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-navy-900">{notice.description}</p>
                <div className="mt-3 grid gap-1 text-[11px] text-slate-500">
                  <span>
                    Origin <strong className="text-navy-800">{notice.originStation}</strong> · {notice.createdBy}
                  </span>
                  <span>Created {formatDateTime(notice.createdAt, true)}</span>
                  {notice.closedAt ? <span>Closed {formatDateTime(notice.closedAt, true)}</span> : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCheck className="h-4 w-4" /> {notice.acknowledgedStations} station acknowledgement(s)
                  </span>
                  {notice.acknowledgedStationNames.length ? (
                    <span className="truncate text-[11px] text-slate-400" title={notice.acknowledgedStationNames.join(", ")}>
                      {notice.acknowledgedStationNames.slice(0, 2).join(", ")}
                      {notice.acknowledgedStationNames.length > 2 ? ` +${notice.acknowledgedStationNames.length - 2}` : ""}
                    </span>
                  ) : null}
                </div>
                {notice.status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => void closeNotice(notice)}
                    disabled={busyCode === notice.infoCode}
                    className="btn-outline btn-sm mt-3 w-full text-red-700"
                  >
                    {busyCode === notice.infoCode ? <Spinner className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    {busyCode === notice.infoCode ? "Closing…" : "Close notice"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
