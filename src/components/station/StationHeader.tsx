"use client";

import {
  Bell,
  BellRing,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Siren,
  Smartphone,
  TrainFront,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BrandMark } from "@/components/Logo";
import { cn, formatClock } from "@/components/ui";
import type { SessionUser } from "@/lib/types";
import type { StationTab } from "./station-types";

const TABS: Array<{ id: StationTab; label: string; short: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Dashboard", short: "Home", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "requests", label: "Assistance requests", short: "Requests", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "tracking", label: "Train tracking", short: "Tracking", icon: <TrainFront className="h-4 w-4" /> },
  { id: "info", label: "Information & notices", short: "Notices", icon: <Megaphone className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", short: "Alerts", icon: <Bell className="h-4 w-4" /> },
];

export default function StationHeader({
  user,
  tab,
  onTab,
  unreadCount,
  liveStatus,
  soundEnabled,
  pushActive,
  now,
  onToggleSound,
  onTestAlarm,
  onLogout,
}: {
  user: SessionUser;
  tab: StationTab;
  onTab: (tab: StationTab) => void;
  unreadCount: number;
  liveStatus: "live" | "connecting" | "offline";
  soundEnabled: boolean;
  pushActive: boolean;
  now: number;
  onToggleSound: () => void;
  onTestAlarm: () => void;
  onLogout: () => void;
}) {
  const liveStyles = {
    live: "bg-emerald-400",
    connecting: "bg-amber-400",
    offline: "bg-red-400",
  };
  const liveText = { live: "Live", connecting: "Syncing", offline: "Offline" };

  return (
    <header className="surface-navy sticky top-0 z-40 text-white shadow-lg">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="hidden sm:block">
          <BrandMark compact light />
        </div>
        <div className="block sm:hidden">
          <BrandMark compact light />
        </div>

        <div className="mx-1 hidden h-9 w-px bg-white/15 md:block" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-bold sm:text-base">{user.stationName}</h1>
            <span className="hidden rounded bg-metro-yellow px-1.5 py-0.5 text-[10px] font-extrabold text-metro-navy sm:inline">
              {user.stationCode}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/60 sm:text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", liveStyles[liveStatus])} />
              {liveText[liveStatus]}
            </span>
            <span className="hidden lg:inline">· {formatClock(now)} IST</span>
            <span className="hidden items-center gap-1 lg:inline-flex">
              · {pushActive ? "Push active" : soundEnabled ? "Sound enabled" : "Sound off"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSound}
            className={cn(
              "btn-sm rounded-lg px-2.5",
              soundEnabled ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/80 hover:bg-white/15"
            )}
            title={soundEnabled ? "Mute alarm sound" : "Enable alarm sound"}
            aria-label={soundEnabled ? "Mute alarm sound" : "Enable alarm sound"}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="hidden xl:inline">{soundEnabled ? "Sound on" : "Enable sound"}</span>
          </button>

          <button
            type="button"
            onClick={onTestAlarm}
            className="btn-sm rounded-lg bg-white/10 px-2.5 text-white/80 hover:bg-white/15"
            title="Test alarm"
            aria-label="Test alarm"
          >
            <Siren className="h-5 w-5" />
            <span className="hidden xl:inline">Test</span>
          </button>

          <button
            type="button"
            onClick={() => onTab("notifications")}
            className="btn-sm relative rounded-lg bg-white/10 px-2.5 text-white/80 hover:bg-white/15"
            aria-label="Open notifications"
          >
            {unreadCount > 0 ? <BellRing className="h-5 w-5 text-metro-yellow" /> : <Bell className="h-5 w-5" />}
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-metro-red px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          <a
            href="/downloads/METRO-ASSIST.apk"
            download
            className="btn-sm rounded-lg bg-white/10 px-2.5 text-white/80 hover:bg-white/15"
            aria-label="Download Android APK"
            title="Download Android APK"
          >
            <Smartphone className="h-5 w-5" />
          </a>

          <button
            type="button"
            onClick={onLogout}
            className="btn-sm rounded-lg bg-white/10 px-2.5 text-white/80 hover:bg-white/15"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="border-t border-white/10 bg-navy-950/40">
        <div className="scrollbar-thin mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-2 py-1.5 sm:px-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
                tab === item.id
                  ? "bg-white text-navy-950"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.short}</span>
              {item.id === "notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-metro-red px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
