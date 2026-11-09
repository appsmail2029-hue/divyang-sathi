"use client";

import { useEffect, useState } from "react";
import { BellRing, Save, Settings2, ShieldAlert } from "lucide-react";
import { AlertBanner, Spinner } from "@/components/ui";
import { errorMessage, putJson } from "@/lib/client-api";
import type { AppSettings } from "@/lib/types";
import type { AdminApi } from "./admin-types";
import { SectionError, SectionHeader, SectionLoading } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

export default function SettingsSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<{ settings: AppSettings; pushConfigured: boolean }>(
    "/api/admin/settings",
    api.version
  );
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const settingsKey = data ? JSON.stringify(data.settings) : "";

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [settingsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <SectionLoading label="Loading settings…" />;
  if (error) return <SectionError message={error} onRetry={reload} />;
  if (!data || !form) return null;

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveError("");
    try {
      await putJson("/api/admin/settings", form);
      api.notify("success", "System settings saved. Connected stations refresh automatically.");
      api.refresh();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="System settings"
        description="Alarm timing, notification channels, notice retention and organisation identity. Changes are broadcast to connected station dashboards."
        actions={
          <button type="submit" form="settings-form" className="btn-primary btn-sm" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        }
      />

      {data.pushConfigured ? (
        <AlertBanner tone="success" title="Web Push is configured">
          VAPID keys are available on the server. Station staff can enable push alerts from the Alerts tab so alarms
          arrive even when the dashboard is closed.
        </AlertBanner>
      ) : (
        <AlertBanner tone="warning" title="Web Push keys are not configured">
          Set <span className="kbd">VAPID_PUBLIC_KEY</span>, <span className="kbd">VAPID_PRIVATE_KEY</span> and{" "}
          <span className="kbd">VAPID_SUBJECT</span> in <span className="kbd">.env.local</span>. Local in-browser
          alarms and sound continue to work without push.
        </AlertBanner>
      )}

      <form id="settings-form" onSubmit={save} className="grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-navy-700" />
            <h3 className="text-sm font-bold text-navy-950">Operations</h3>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="org-name" className="label">
                Organisation name
              </label>
              <input
                id="org-name"
                className="input"
                value={form.organizationName}
                onChange={(event) => update("organizationName", event.target.value)}
                maxLength={80}
                required
              />
              <p className="field-help">Shown on station dashboards and printed reports.</p>
            </div>
            <div>
              <label htmlFor="seconds-station" className="label">
                Seconds per station (ETA model)
              </label>
              <input
                id="seconds-station"
                type="number"
                min={30}
                max={900}
                step={1}
                className="input"
                value={form.secondsPerStation}
                onChange={(event) => update("secondsPerStation", Number(event.target.value))}
                required
              />
              <p className="field-help">
                Used by the server to estimate arrival time. 180 seconds equals the standard 3 minutes per station.
              </p>
            </div>
            <div>
              <label htmlFor="auto-close" className="label">
                Auto-close notices after (days)
              </label>
              <input
                id="auto-close"
                type="number"
                min={1}
                max={365}
                step={1}
                className="input"
                value={form.autoCloseNoticeDays}
                onChange={(event) => update("autoCloseNoticeDays", Number(event.target.value))}
                required
              />
              <p className="field-help">Open notices older than this are closed automatically when a station refreshes.</p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-navy-700" />
            <h3 className="text-sm font-bold text-navy-950">Alarms & notifications</h3>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="alarm-volume" className="label">
                Alarm volume · {Math.round(form.alarmVolume * 100)}%
              </label>
              <input
                id="alarm-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.alarmVolume}
                onChange={(event) => update("alarmVolume", Number(event.target.value))}
                className="w-full accent-[#0b2447]"
              />
              <p className="field-help">Applies to the in-browser siren on station devices after their next refresh.</p>
            </div>
            <div>
              <label htmlFor="alarm-repeat" className="label">
                Alarm repeat interval (seconds)
              </label>
              <input
                id="alarm-repeat"
                type="number"
                min={2}
                max={120}
                step={1}
                className="input"
                value={form.alarmRepeatSeconds}
                onChange={(event) => update("alarmRepeatSeconds", Number(event.target.value))}
                required
              />
            </div>
            <div className="space-y-2.5">
              {(
                [
                  ["browserNotifications", "Browser notifications", "Show desktop notifications when the dashboard is in the background."],
                  ["pushEnabled", "Web Push delivery", "Send high-priority alarms to subscribed devices, even when the app is closed."],
                  ["demoMode", "Demo mode", "Display the synthetic-data banner on station dashboards."],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(event) => update(key, event.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-[#0b2447]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-navy-900">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="card p-5 xl:col-span-2">
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
            <div>
              <div className="font-bold text-navy-900">Prototype security notice</div>
              <p className="mt-0.5">
                This installation is an independent prototype. Do not connect it to DMRC internal systems or use real
                passenger data without authorisation. Replace the temporary station password and all demonstration
                accounts before any field deployment.
              </p>
            </div>
          </div>
          {saveError ? (
            <div className="mt-3">
              <AlertBanner tone="danger">{saveError}</AlertBanner>
            </div>
          ) : null}
        </section>
      </form>
    </div>
  );
}
