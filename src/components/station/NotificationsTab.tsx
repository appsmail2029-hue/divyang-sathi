"use client";

import { useMemo, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Info,
  Megaphone,
  MonitorSmartphone,
  Siren,
  Smartphone,
  TrainFront,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import {
  EmptyState,
  PriorityBadge,
  Spinner,
  cn,
  formatDateTime,
  relativeTime,
  useNow,
} from "@/components/ui";
import type { NotificationItem } from "@/lib/types";
import type { StationApi } from "./station-types";

const KIND_LABEL: Record<string, string> = {
  NEW_REQUEST: "New assistance request",
  REQUEST_CREATED: "Request created — destination notified",
  REQUEST_ACKNOWLEDGED: "Request acknowledged",
  TRAIN_DEPARTED: "Train departed",
  TRAIN_ARRIVED: "Train arrived",
  APPROACHING_ALARM: "Three-station alarm",
  REQUEST_COMPLETED: "Request completed",
  INFO_BROADCAST: "Information broadcast",
  TEST_ALARM: "Test alarm",
};

export default function NotificationsTab({
  notifications,
  api,
  soundEnabled,
  onToggleSound,
  onTestAlarm,
  onMarkRead,
  onMarkAllRead,
  markAllBusy,
  busyId,
  pushState,
  browserPermission,
  onEnableBrowser,
  onEnablePush,
  pushBusy,
}: {
  notifications: NotificationItem[];
  api: StationApi;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestAlarm: () => void;
  onMarkRead: (notification: NotificationItem, action: "read" | "silence") => void;
  onMarkAllRead: () => void;
  markAllBusy: boolean;
  busyId: number | null;
  pushState: "unsupported" | "inactive" | "active" | "busy" | "unconfigured" | "denied";
  browserPermission: NotificationPermission | "unsupported";
  onEnableBrowser: () => void;
  onEnablePush: () => void;
  pushBusy: boolean;
}) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "ALARM">("ALL");
  const now = useNow(30_000);
  const unread = notifications.filter((item) => item.status === "UNREAD").length;

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === "UNREAD") return item.status === "UNREAD";
      if (filter === "ALARM") return item.priority !== "NORMAL";
      return true;
    });
  }, [notifications, filter]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-navy-950">Notification delivery history</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Every alarm and information notice delivered to your station, including browser and push channels.
              </p>
            </div>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={onMarkAllRead}
              disabled={markAllBusy || unread === 0}
            >
              {markAllBusy ? <Spinner className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
              Mark all read
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["ALL", "UNREAD", "ALARM"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn("tab min-h-[38px] px-3 text-xs", filter === value && "tab-active")}
              >
                {value === "ALL" ? `All (${notifications.length})` : value === "UNREAD" ? `Unread (${unread})` : "Alarms"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "px-4 py-3",
                  item.status === "UNREAD" && item.priority !== "NORMAL" && "bg-amber-50/60",
                  item.status === "UNREAD" && item.priority === "CRITICAL" && "bg-red-50/60"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.priority === "CRITICAL"
                        ? "bg-red-100 text-red-700"
                        : item.priority === "HIGH"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {item.priority === "CRITICAL" ? (
                      <Siren className="h-4 w-4" />
                    ) : item.kind === "INFO_BROADCAST" ? (
                      <Megaphone className="h-4 w-4" />
                    ) : item.kind.includes("TRAIN") ? (
                      <TrainFront className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-navy-950">{item.title}</span>
                      <PriorityBadge priority={item.priority} />
                      <span className={cn("chip", item.status === "UNREAD" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-500")}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {KIND_LABEL[item.kind] || item.kind} · {formatDateTime(item.createdAt, true)}
                      {item.status !== "UNREAD" && item.readAt ? ` · read ${relativeTime(item.readAt, now)}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {item.requestId ? (
                      <button type="button" className="btn-ghost btn-sm text-xs" onClick={() => api.openDetail(item.requestId!)}>
                        Details
                      </button>
                    ) : null}
                    {item.infoId ? (
                      <button type="button" className="btn-ghost btn-sm text-xs" onClick={() => api.openTab("info")}>
                        Notice
                      </button>
                    ) : null}
                    {item.status === "UNREAD" ? (
                      <>
                        <button
                          type="button"
                          className="btn-outline btn-sm text-xs"
                          disabled={busyId === item.id}
                          onClick={() => onMarkRead(item, "read")}
                        >
                          {busyId === item.id ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          Read
                        </button>
                        {item.priority !== "NORMAL" ? (
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-xs text-slate-500"
                            disabled={busyId === item.id}
                            onClick={() => onMarkRead(item, "silence")}
                          >
                            <VolumeX className="h-3.5 w-3.5" /> Silence
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1.5 pl-10 text-sm text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<Bell className="h-10 w-10" />}
              title={filter === "UNREAD" ? "No unread notifications" : "No notifications yet"}
              description="Alarm and information notifications delivered to this station will be listed here with their delivery status."
            />
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            <Volume2 className="h-4 w-4" /> Alarm settings
          </h3>
          <div className="mt-3 space-y-2">
            <SettingRow
              icon={soundEnabled ? <Volume2 className="h-5 w-5 text-emerald-600" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
              title="Station alarm sound"
              description={soundEnabled ? "Audible siren and chime are enabled on this device." : "Enable sound to hear request and approach alarms."}
              action={
                <button type="button" className={cn("btn-sm", soundEnabled ? "btn-outline" : "btn-yellow")} onClick={onToggleSound}>
                  {soundEnabled ? "Mute" : "Enable sound"}
                </button>
              }
            />
            <SettingRow
              icon={<Siren className="h-5 w-5 text-red-600" />}
              title="Test alarm"
              description="Play the siren and show the flashing test popup on this device."
              action={
                <button type="button" className="btn-outline btn-sm" onClick={onTestAlarm}>
                  Test
                </button>
              }
            />
            <SettingRow
              icon={<BellRing className={cn("h-5 w-5", browserPermission === "granted" ? "text-emerald-600" : "text-slate-400")} />}
              title="Browser notifications"
              description={
                browserPermission === "unsupported"
                  ? "This browser does not support desktop notifications."
                  : browserPermission === "granted"
                    ? "Desktop notifications are allowed for this site."
                    : browserPermission === "denied"
                      ? "Blocked. Allow notifications in your browser site settings."
                      : "Allow desktop notifications even when the tab is in the background."
              }
              action={
                browserPermission === "granted" ? (
                  <span className="chip bg-emerald-100 text-emerald-800">Enabled</span>
                ) : browserPermission === "denied" || browserPermission === "unsupported" ? (
                  <span className="chip bg-slate-100 text-slate-500">Unavailable</span>
                ) : (
                  <button type="button" className="btn-outline btn-sm" onClick={onEnableBrowser}>
                    Allow
                  </button>
                )
              }
            />
            <SettingRow
              icon={<Smartphone className={cn("h-5 w-5", pushState === "active" ? "text-emerald-600" : "text-slate-400")} />}
              title="Push notifications"
              description={
                pushState === "active"
                  ? "This device receives push alarms even when Metro Assist is closed."
                  : pushState === "unconfigured"
                    ? "Web Push keys are not configured on the server."
                    : pushState === "denied"
                      ? "Notification permission was denied. Allow it in browser settings."
                      : pushState === "unsupported"
                        ? "Push is unavailable in this browser."
                        : "Register this device for background push alerts."
              }
              action={
                pushState === "active" ? (
                  <span className="chip bg-emerald-100 text-emerald-800">Active</span>
                ) : pushState === "unconfigured" || pushState === "unsupported" || pushState === "denied" ? (
                  <span className="chip bg-slate-100 text-slate-500">Unavailable</span>
                ) : (
                  <button type="button" className="btn-outline btn-sm" onClick={onEnablePush} disabled={pushBusy}>
                    {pushBusy ? <Spinner className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                    Enable
                  </button>
                )
              }
            />
          </div>
        </div>

        <div className="card bg-navy-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <Info className="h-4 w-4" /> How alarms work
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-navy-800">
            <li className="flex gap-1.5">
              <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A new destination request triggers an immediate
              flashing popup and siren until acknowledged or silenced.
            </li>
            <li className="flex gap-1.5">
              <Siren className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The second alarm fires once, when the boarding station
              saves the train location exactly three stations before the destination.
            </li>
            <li className="flex gap-1.5">
              <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Events are persisted in the database and
              redelivered after reconnection; push notifications cover closed or background tabs.
            </li>
            <li className="flex gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Acknowledge and silence actions are recorded against
              your staff account in the audit log.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-navy-950">{title}</div>
        <div className="text-[11px] leading-snug text-slate-500">{description}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
