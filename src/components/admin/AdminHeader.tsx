"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Megaphone,
  RefreshCw,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/Logo";
import { cn, formatClock, useNow } from "@/components/ui";
import type { AdminTab } from "./admin-types";
import type { SessionUser } from "@/lib/types";

const TABS: Array<{ id: AdminTab; label: string; short: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", short: "Home", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "stations", label: "Stations", short: "Stations", icon: <Building2 className="h-4 w-4" /> },
  { id: "routes", label: "Routes", short: "Routes", icon: <Route className="h-4 w-4" /> },
  { id: "users", label: "Users", short: "Users", icon: <Users className="h-4 w-4" /> },
  { id: "requests", label: "Requests", short: "Requests", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "notices", label: "Notices", short: "Notices", icon: <Megaphone className="h-4 w-4" /> },
  { id: "reports", label: "Reports", short: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "settings", label: "Settings", short: "Settings", icon: <Settings className="h-4 w-4" /> },
  { id: "audit", label: "Audit", short: "Audit", icon: <ScrollText className="h-4 w-4" /> },
  { id: "export", label: "Backup", short: "Backup", icon: <Database className="h-4 w-4" /> },
];

export default function AdminHeader({
  user,
  tab,
  onTab,
  live,
  onRefresh,
  onLogout,
}: {
  user: SessionUser;
  tab: AdminTab;
  onTab: (tab: AdminTab) => void;
  live: "live" | "connecting" | "offline";
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const now = useNow(1000);
  const liveStyles = { live: "bg-emerald-400", connecting: "bg-amber-400", offline: "bg-red-400" };
  const liveText = { live: "Live", connecting: "Syncing", offline: "Offline" };

  return (
    <header className="surface-navy sticky top-0 z-40 text-white shadow-lg">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
        <BrandMark compact light />

        <div className="mx-1 hidden h-9 w-px bg-white/15 md:block" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-bold sm:text-base">Administrator portal</h1>
            <span className="hidden items-center gap-1 rounded bg-metro-yellow px-1.5 py-0.5 text-[10px] font-extrabold text-metro-navy sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> ADMIN
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/60 sm:text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", liveStyles[live])} />
              {liveText[live]}
            </span>
            <span className="hidden sm:inline">· Signed in as {user.displayName}</span>
            <span className="hidden lg:inline">· {formatClock(now)} IST</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
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
            onClick={onRefresh}
            className="btn-sm rounded-lg bg-white/10 px-2.5 text-white/80 hover:bg-white/15"
            aria-label="Refresh administrator data"
            title="Refresh data"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
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
              title={item.label}
              className={cn(
                "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
                tab === item.id ? "bg-white text-navy-950" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
              <span className="md:hidden">{item.short}</span>
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
