"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, RefreshCw, Save, TriangleAlert } from "lucide-react";
import { AlertBanner, Spinner, cn } from "@/components/ui";
import { errorDetails, errorMessage, putJson } from "@/lib/client-api";
import type { Direction } from "@/lib/types";
import type { AdminApi, AdminStation } from "./admin-types";
import { SectionError, SectionHeader, SectionLoading } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

interface RouteStation {
  id: number;
  code: string;
  name: string;
  sequence: number;
}

interface Verification {
  ok: boolean;
  issues: string[];
  activeStations: number;
  plusCount: number;
  minusCount: number;
}

interface RoutesResponse {
  routes: { plus: RouteStation[]; minus: RouteStation[] };
  verification: Verification;
  stations: AdminStation[];
}

function savedFor(data: RoutesResponse, direction: Direction): number[] {
  return (direction === "+" ? data.routes.plus : data.routes.minus).map((station) => station.id);
}

function buildOrder(data: RoutesResponse, direction: Direction): number[] {
  const active = data.stations.filter((station) => station.active);
  const activeIds = new Set(active.map((station) => station.id));
  const ordered = savedFor(data, direction).filter((id) => activeIds.has(id));
  const missing = active
    .filter((station) => !ordered.includes(station.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...missing.map((station) => station.id)];
}

export default function RoutesSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<RoutesResponse>("/api/admin/routes", api.version);
  const [direction, setDirection] = useState<Direction>("+");
  const [order, setOrder] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveDetails, setSaveDetails] = useState<string[]>([]);

  const baseline = useMemo(() => (data ? buildOrder(data, direction) : []), [data, direction]);
  const baselineKey = baseline.join(",");

  useEffect(() => {
    setOrder(baseline);
  }, [baselineKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const stationMap = useMemo(() => {
    const map = new Map<number, AdminStation>();
    data?.stations.forEach((station) => map.set(station.id, station));
    return map;
  }, [data]);

  const dirty = order.join(",") !== baselineKey;

  if (loading && !data) return <SectionLoading label="Loading route sequences…" />;
  if (error) return <SectionError message={error} onRetry={reload} />;
  if (!data) return null;

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= order.length) return;
    setOrder((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  async function saveSequence() {
    setSaving(true);
    setSaveError("");
    setSaveDetails([]);
    try {
      await putJson(`/api/admin/routes`, { direction, stationIds: order });
      api.notify("success", `${direction === "+" ? "+" : "-"} Circular sequence saved with ${order.length} stations.`);
      api.refresh();
    } catch (err) {
      setSaveError(errorMessage(err));
      setSaveDetails(errorDetails(err));
    } finally {
      setSaving(false);
    }
  }

  const verification = data.verification;
  const outdatedInactive = data.stations.filter((station) => !station.active && order.includes(station.id));

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Route sequences"
        description="Maintain the + Circular and - Circular order used for journey validation, remaining-station counts and the three-station alarm."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                api.refresh();
                api.notify("info", "Route verification refreshed.");
              }}
              className="btn-outline btn-sm bg-white"
            >
              <RefreshCw className="h-4 w-4" /> Re-run verification
            </button>
            <button
              type="button"
              onClick={() => setOrder(baseline)}
              disabled={!dirty || saving}
              className="btn-outline btn-sm bg-white"
            >
              Reset changes
            </button>
            <button type="button" onClick={() => void saveSequence()} disabled={saving || !order.length} className="btn-primary btn-sm">
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save sequence"}
            </button>
          </>
        }
      />

      <AlertBanner tone="warning" title="Verify the official sequence before deployment">
        The bundled 38-station dataset is a demonstration loop, not confirmed DMRC data. Replace it through{" "}
        <strong>Stations → Import file</strong> with the administrator-verified Pink Line order, then review both
        directions here.
      </AlertBanner>

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
          verification.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        )}
      >
        {verification.ok ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div>
          <div className="font-bold">
            {verification.ok ? "Route configuration is consistent" : "Route configuration needs attention"}
          </div>
          <div className="mt-0.5 text-xs">
            {verification.activeStations} active station(s) · + Circular {verification.plusCount} · - Circular{" "}
            {verification.minusCount}
          </div>
          {verification.issues.length ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
              {verification.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["+", "-"] as Direction[]).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes to the current sequence?")) return;
              setDirection(dir);
            }}
            className={cn(
              "inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 text-sm font-bold",
              direction === dir ? "bg-metro-navy text-white" : "border border-slate-200 bg-white text-navy-900 hover:bg-navy-50"
            )}
          >
            {dir === "+" ? "+ Circular" : "- Circular"}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                direction === dir ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {dir === "+" ? data.routes.plus.length : data.routes.minus.length}
            </span>
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold text-slate-500">
          {order.length} station(s) in this sequence
          {dirty ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Unsaved changes</span> : null}
        </span>
      </div>

      {saveError ? (
        <div>
          <AlertBanner tone="danger">{saveError}</AlertBanner>
          {saveDetails.length ? (
            <ul className="mt-2 list-inside list-disc rounded-lg bg-red-50 px-4 py-2 text-xs text-red-800">
              {saveDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {outdatedInactive.length ? (
        <AlertBanner tone="info">
          {outdatedInactive.length} inactive station(s) are still shown on the saved sequence. Saving this form removes
          them.
        </AlertBanner>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-navy-950">
              {direction === "+" ? "+ Circular" : "- Circular"} stop order
            </h3>
            <p className="text-xs text-slate-500">
              Move stations with the arrow controls. Every active station must remain in the list.
            </p>
          </div>
        </div>
        <ol className="scrollbar-thin max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
          {order.map((id, index) => {
            const station = stationMap.get(id);
            if (!station) return null;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-navy-950">{station.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {station.code}
                    {!station.active ? " · inactive" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-slate-200 p-2 text-navy-700 hover:bg-navy-50 disabled:opacity-30"
                    aria-label={`Move ${station.name} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                    className="rounded-lg border border-slate-200 p-2 text-navy-700 hover:bg-navy-50 disabled:opacity-30"
                    aria-label={`Move ${station.name} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
