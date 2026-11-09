"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { ToastStack, useInterval, type ToastItem, type ToastKind } from "@/components/ui";
import type { SessionUser } from "@/lib/types";
import AdminHeader from "./AdminHeader";
import AuditSection from "./AuditSection";
import ExportSection from "./ExportSection";
import NoticesSection from "./NoticesSection";
import OverviewSection from "./OverviewSection";
import ReportsSection from "./ReportsSection";
import RequestsSection from "./RequestsSection";
import RoutesSection from "./RoutesSection";
import SettingsSection from "./SettingsSection";
import StationsSection from "./StationsSection";
import UsersSection from "./UsersSection";
import type { AdminApi, AdminTab } from "./admin-types";

type LiveStatus = "live" | "connecting" | "offline";

export default function AdminApp({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [version, setVersion] = useState(0);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(1);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: number | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      source?.close();
      setLive("connecting");
      source = new EventSource("/api/events");
      source.addEventListener("ready", () => setLive("live"));
      source.addEventListener("message", () => setVersion((value) => value + 1));
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        setLive("offline");
        retry = window.setTimeout(connect, 4000);
      };
    };

    connect();
    const onOnline = () => connect();
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      source?.close();
      if (retry != null) window.clearTimeout(retry);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useInterval(refresh, live === "live" ? null : 20000);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/me", { method: "DELETE" });
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      window.location.href = "/login";
    }
  }, [notify]);

  const api: AdminApi = {
    version,
    refresh,
    notify,
    setTab,
  };

  return (
    <div className="min-h-dvh bg-slate-100">
      <AdminHeader
        user={user}
        tab={tab}
        onTab={setTab}
        live={live}
        onRefresh={() => {
          refresh();
          notify("info", "Administrator data refreshed.");
        }}
        onLogout={() => void logout()}
      />

      <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
        {tab === "overview" ? <OverviewSection api={api} /> : null}
        {tab === "stations" ? <StationsSection api={api} /> : null}
        {tab === "routes" ? <RoutesSection api={api} /> : null}
        {tab === "users" ? <UsersSection api={api} /> : null}
        {tab === "requests" ? <RequestsSection api={api} /> : null}
        {tab === "notices" ? <NoticesSection api={api} /> : null}
        {tab === "reports" ? <ReportsSection api={api} /> : null}
        {tab === "settings" ? <SettingsSection api={api} /> : null}
        {tab === "audit" ? <AuditSection api={api} /> : null}
        {tab === "export" ? <ExportSection /> : null}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-6 text-center text-[11px] text-slate-400">
        Metro Assist administrator portal · Independent prototype, not affiliated with DMRC · Verify all route and
        station data before deployment.
      </footer>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
