"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Info, Volume2, VolumeX, X, WifiOff } from "lucide-react";
import {
  Spinner,
  ToastStack,
  useInterval,
  useNow,
  type ToastItem,
  type ToastKind,
} from "@/components/ui";
import { ApiError, apiFetch, errorMessage, postJson } from "@/lib/client-api";
import type {
  AppSettings,
  AssistanceRequest,
  AssistanceType,
  DashboardData,
  NotificationItem,
  SessionUser,
} from "@/lib/types";
import AlarmOverlay from "./AlarmOverlay";
import InfoTab from "./InfoTab";
import NotificationsTab from "./NotificationsTab";
import OverviewTab from "./OverviewTab";
import RequestDetailModal from "./RequestDetailModal";
import RequestFormModal from "./RequestFormModal";
import RequestsTab from "./RequestsTab";
import StationHeader from "./StationHeader";
import TrackingTab from "./TrackingTab";
import UpdateLocationModal from "./UpdateLocationModal";
import type { StationApi, StationTab } from "./station-types";

type LiveStatus = "live" | "connecting" | "offline";
type PushState = "unsupported" | "inactive" | "active" | "busy" | "unconfigured" | "denied";

interface AudioEngine {
  ctx: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
  timer: number | null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export default function StationApp({ user }: { user: SessionUser }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<StationTab>("overview");
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<number | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState<string | null>(null);
  const [formType, setFormType] = useState<AssistanceType | null>(null);
  const [infoComposerOpen, setInfoComposerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundPromptDismissed, setSoundPromptDismissed] = useState(false);
  const [pushState, setPushState] = useState<PushState>("inactive");
  const [pushBusy, setPushBusy] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState("");

  const now = useNow(1000);
  const toastsRef = useRef(1);
  const enqueuedRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<AudioEngine | null>(null);
  const vapidKeyRef = useRef("");
  const settingsRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    settingsRef.current = data?.settings ?? null;
  }, [data?.settings]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = toastsRef.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<DashboardData>("/api/dashboard");
      setData(next);
      setLoadError("");
      setVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.href = "/login";
        return;
      }
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ------------------------------ alarm sound ------------------------------ */

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 760;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      audioRef.current = { ctx, oscillator, gain, timer: null };
    }
    if (audioRef.current.ctx.state === "suspended") void audioRef.current.ctx.resume();
    return audioRef.current;
  }, []);

  const stopSiren = useCallback(() => {
    const engine = audioRef.current;
    if (!engine) return;
    if (engine.timer != null) {
      window.clearInterval(engine.timer);
      engine.timer = null;
    }
    const t = engine.ctx.currentTime;
    engine.gain.gain.cancelScheduledValues(t);
    engine.gain.gain.setValueAtTime(0.0001, t);
  }, []);

  const startSiren = useCallback(() => {
    const engine = ensureAudio();
    if (!engine || engine.timer != null) return;
    const volume = Math.min(1, Math.max(0, settingsRef.current?.alarmVolume ?? 0.8));
    const peak = Math.max(0.02, 0.16 * volume);
    const repeatSeconds = Math.max(2, settingsRef.current?.alarmRepeatSeconds ?? 8);
    let high = false;
    const beep = () => {
      const current = audioRef.current;
      if (!current || current.timer == null) return;
      const t = current.ctx.currentTime;
      high = !high;
      current.oscillator.frequency.setValueAtTime(high ? 980 : 660, t);
      current.gain.gain.cancelScheduledValues(t);
      current.gain.gain.setValueAtTime(0.0001, t);
      current.gain.gain.exponentialRampToValueAtTime(peak, t + 0.03);
      current.gain.gain.setValueAtTime(peak, t + 0.28);
      current.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    };
    const burst = () => {
      for (let i = 0; i < 4; i += 1) window.setTimeout(beep, i * 450);
    };
    engine.timer = window.setInterval(burst, repeatSeconds * 1000);
    burst();
  }, [ensureAudio]);

  useEffect(() => {
    const stored = window.localStorage.getItem("metro-assist:sound");
    if (stored === "1") setSoundEnabled(true);
    setBrowserPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;
    const unlock = () => {
      ensureAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundEnabled, ensureAudio]);

  const activeAlert = alerts[0] ?? null;
  const activeAlertId = activeAlert?.id;

  useEffect(() => {
    if (activeAlertId != null && soundEnabled) startSiren();
    else stopSiren();
  }, [activeAlertId, soundEnabled, startSiren, stopSiren]);

  useEffect(() => {
    return () => {
      const engine = audioRef.current;
      if (!engine) return;
      if (engine.timer != null) window.clearInterval(engine.timer);
      try {
        engine.oscillator.stop();
        void engine.ctx.close();
      } catch {
        /* already closed */
      }
      audioRef.current = null;
    };
  }, []);

  const enableSound = useCallback(() => {
    setSoundEnabled(true);
    window.localStorage.setItem("metro-assist:sound", "1");
    ensureAudio();
    notify("info", "Alarm sound enabled on this device.");
  }, [ensureAudio, notify]);

  const toggleSound = useCallback(() => {
    if (soundEnabled) {
      setSoundEnabled(false);
      window.localStorage.setItem("metro-assist:sound", "0");
      stopSiren();
      notify("info", "Alarm sound muted on this device.");
    } else {
      enableSound();
    }
  }, [soundEnabled, enableSound, notify, stopSiren]);

  /* --------------------------- browser notifications --------------------------- */

  const showBrowserNotification = useCallback((notification: NotificationItem) => {
    if (settingsRef.current?.browserNotifications === false) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;
    try {
      new Notification(notification.title, {
        body: notification.body,
        tag: `metro-assist-${notification.id}`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        requireInteraction: notification.priority !== "NORMAL",
      } as NotificationOptions);
    } catch {
      /* some browsers restrict constructor notifications */
    }
  }, []);

  const enableBrowserNotifications = useCallback(async () => {
    if (settingsRef.current?.browserNotifications === false) {
      notify("error", "Browser notifications are disabled by the administrator.");
      return;
    }
    if (typeof Notification === "undefined") {
      notify("error", "This browser does not support desktop notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === "granted") {
      notify("success", "Browser notifications enabled for this device.");
      try {
        new Notification("Metro Assist notifications enabled", {
          body: "Alarms will appear here when the station dashboard is in the background.",
          icon: "/icons/icon-192.png",
        });
      } catch {
        /* ignore */
      }
    } else {
      notify("error", "Notification permission was not granted.");
    }
  }, [notify]);

  /* -------------------------------- push setup -------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        setPushState("unsupported");
        return;
      }
      try {
        const info = await apiFetch<{ configured: boolean; publicKey: string }>("/api/push/key");
        if (cancelled) return;
        if (!info.configured || !info.publicKey) {
          setPushState("unconfigured");
          return;
        }
        vapidKeyRef.current = info.publicKey;
        if (Notification.permission === "denied") {
          setPushState("denied");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setPushState(subscription ? "active" : "inactive");
      } catch {
        if (!cancelled) setPushState("inactive");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushState("busy");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }
      if (!vapidKeyRef.current) throw new Error("Push keys are not configured on the server.");
      const permission =
        Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission !== "granted") throw new Error("Notification permission is required for push alerts.");
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyRef.current);
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        }));
      await postJson("/api/push/subscribe", { subscription: subscription.toJSON() });
      setPushState("active");
      notify("success", "Push notifications enabled. Alarms will arrive even when this app is closed.");
    } catch (error) {
      setPushState(Notification.permission === "denied" ? "denied" : "inactive");
      notify("error", errorMessage(error));
    } finally {
      setPushBusy(false);
    }
  }, [notify, pushBusy]);

  /* ------------------------------ alert queueing ------------------------------ */

  const enqueueAlert = useCallback(
    (notification: NotificationItem) => {
      if (notification.priority === "NORMAL" || notification.status !== "UNREAD") return;
      if (notification.id <= 0 || enqueuedRef.current.has(notification.id)) return;
      enqueuedRef.current.add(notification.id);
      setAlerts((prev) => (prev.some((item) => item.id === notification.id) ? prev : [...prev, notification]));
      showBrowserNotification(notification);
    },
    [showBrowserNotification]
  );

  useEffect(() => {
    if (!data) return;
    const fresh = data.notifications.filter(
      (notification) =>
        notification.status === "UNREAD" &&
        notification.priority !== "NORMAL" &&
        Date.now() - new Date(notification.createdAt).getTime() < 12 * 3600_000
    );
    fresh
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach(enqueueAlert);
    setAlerts((prev) =>
      prev.filter((alert) => {
        if (alert.kind === "TEST_ALARM" || alert.id <= 0) return true;
        const match = data.notifications.find((notification) => notification.id === alert.id);
        return !match || match.status === "UNREAD";
      })
    );
  }, [data, enqueueAlert]);

  /* --------------------------------- realtime --------------------------------- */

  const handleEvent = useCallback(
    (event: { type?: string; notification?: NotificationItem }) => {
      if (event.type === "notification" && event.notification) {
        enqueueAlert(event.notification);
      }
      if (
        event.type === "notification" ||
        event.type === "notification.updated" ||
        event.type === "request.created" ||
        event.type === "request.updated" ||
        event.type === "info.created" ||
        event.type === "info.updated"
      ) {
        void refresh();
      }
    },
    [enqueueAlert, refresh]
  );

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: number | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setLive("connecting");
      source = new EventSource("/api/events");
      source.addEventListener("ready", () => {
        setLive("live");
        void refresh();
      });
      source.addEventListener("message", (event) => {
        try {
          handleEvent(JSON.parse((event as MessageEvent).data));
        } catch {
          /* ignore malformed events */
        }
      });
      source.onerror = () => {
        setLive("offline");
        source?.close();
        source = null;
        if (!stopped) retry = window.setTimeout(connect, 4000);
      };
    };

    connect();
    const onOnline = () => {
      if (!source && !stopped) connect();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      source?.close();
      if (retry != null) window.clearTimeout(retry);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handleEvent, refresh]);

  useInterval(
    () => {
      if (live !== "live" && document.visibilityState === "visible") void refresh();
    },
    live === "live" ? null : 12000
  );

  /* --------------------------------- actions --------------------------------- */

  const acknowledge = useCallback(
    async (code: string) => {
      setBusyCode(code);
      try {
        const { request } = await postJson<{ request: AssistanceRequest }>(
          `/api/requests/${encodeURIComponent(code)}/acknowledge`
        );
        setAlerts((prev) => prev.filter((alert) => alert.requestId !== code));
        notify(
          "success",
          `Request ${request.requestCode} acknowledged. ${request.boardingStation} can now mark the train departed.`
        );
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyCode(null);
      }
    },
    [notify, refresh]
  );

  const silenceRequest = useCallback(
    async (code: string) => {
      setBusyCode(code);
      try {
        await postJson(`/api/requests/${encodeURIComponent(code)}/silence`);
        setAlerts((prev) => prev.filter((alert) => alert.requestId !== code));
        notify("info", "Alarm silenced. The request still requires acknowledgement.");
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyCode(null);
      }
    },
    [notify, refresh]
  );

  const depart = useCallback(
    async (code: string) => {
      setBusyCode(code);
      try {
        const { request } = await postJson<{ request: AssistanceRequest }>(
          `/api/requests/${encodeURIComponent(code)}/depart`
        );
        notify(
          "success",
          `Train ${request.trainNumber} / Set ${request.trainSet} marked departed. Update the train location station by station.`
        );
        setTab("tracking");
        setData((prev) =>
          prev
            ? {
                ...prev,
                requests: prev.requests.map((item) => (item.requestCode === code ? request : item)),
              }
            : prev
        );
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyCode(null);
      }
    },
    [notify, refresh]
  );

  const complete = useCallback(
    async (code: string) => {
      setBusyCode(code);
      try {
        const { request } = await postJson<{ request: AssistanceRequest }>(
          `/api/requests/${encodeURIComponent(code)}/complete`
        );
        setAlerts((prev) => prev.filter((alert) => alert.requestId !== code));
        notify(
          "success",
          `ASSISTANCE PROVIDED — request ${request.requestCode} completed at ${request.destinationStation}.`
        );
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyCode(null);
      }
    },
    [notify, refresh]
  );

  const markNotification = useCallback(
    async (notification: NotificationItem, action: "read" | "silence") => {
      if (notification.kind === "TEST_ALARM" || notification.id <= 0) {
        setAlerts((prev) => prev.filter((alert) => alert.id !== notification.id));
        return;
      }
      setBusyNotificationId(notification.id);
      try {
        await postJson(`/api/notifications/${notification.id}/read`, { action });
        setAlerts((prev) => prev.filter((alert) => alert.id !== notification.id));
        setData((prev) =>
          prev
            ? {
                ...prev,
                notifications: prev.notifications.map((item) =>
                  item.id === notification.id
                    ? {
                        ...item,
                        status: action === "silence" ? "SILENCED" : "READ",
                        readAt: new Date().toISOString(),
                      }
                    : item
                ),
              }
            : prev
        );
        notify("success", action === "silence" ? "Alarm silenced." : "Notification marked as read.");
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyNotificationId(null);
      }
    },
    [notify, refresh]
  );

  const acknowledgeInfo = useCallback(
    async (infoCode: string) => {
      try {
        await postJson(`/api/info/${encodeURIComponent(infoCode)}/ack`);
        notify("success", `Receipt acknowledged for notice ${infoCode}.`);
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      }
    },
    [notify, refresh]
  );

  const acknowledgeBroadcast = useCallback(
    async (alert: NotificationItem) => {
      if (!alert.infoId) return;
      setBusyNotificationId(alert.id);
      try {
        await postJson(`/api/info/${encodeURIComponent(alert.infoId)}/ack`);
        setAlerts((prev) => prev.filter((item) => item.infoId !== alert.infoId));
        notify("success", `Notice ${alert.infoId} acknowledged.`);
        await refresh();
      } catch (error) {
        notify("error", errorMessage(error));
      } finally {
        setBusyNotificationId(null);
      }
    },
    [notify, refresh]
  );

  const markAllRead = useCallback(async () => {    setMarkAllBusy(true);
    try {
      await postJson("/api/notifications/read-all");
      setAlerts([]);
      notify("success", "All notifications marked as read.");
      await refresh();
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setMarkAllBusy(false);
    }
  }, [notify, refresh]);

  const testAlarm = useCallback(async () => {
    try {
      await postJson("/api/alarm/test");
      const test: NotificationItem = {
        id: -Date.now(),
        kind: "TEST_ALARM",
        priority: "CRITICAL",
        title: "TEST ALARM — SIREN & POPUP CHECK",
        body: `Test alarm triggered at ${user.stationName}. No assistance request was created and no other station was contacted.`,
        stationId: user.stationId,
        requestId: null,
        infoId: null,
        status: "UNREAD",
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      setAlerts((prev) => [test, ...prev.filter((alert) => alert.kind !== "TEST_ALARM")]);
      if (!soundEnabled) notify("info", "Test popup shown. Enable sound to hear the alarm siren.");
    } catch (error) {
      notify("error", errorMessage(error));
    }
  }, [notify, soundEnabled, user.stationId, user.stationName]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/me", { method: "DELETE" });
    } finally {
      window.location.href = "/login";
    }
  }, []);

  const onRequestCreated = useCallback(
    (request: AssistanceRequest) => {
      setFormType(null);
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: [request, ...prev.requests.filter((item) => item.requestCode !== request.requestCode)],
            }
          : prev
      );
      notify(
        "success",
        `Request ${request.requestCode} created. ${request.destinationStation} has been alerted and must acknowledge.`
      );
      setTab("requests");
      setDetailCode(request.requestCode);
      void refresh();
    },
    [notify, refresh]
  );

  const onTrainMoved = useCallback(
    (request: AssistanceRequest) => {
      setLocationCode(null);
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: prev.requests.map((item) => (item.requestCode === request.requestCode ? request : item)),
            }
          : prev
      );
      void refresh();
    },
    [refresh]
  );

  const api = useMemo<StationApi>(
    () => ({
      acknowledge,
      silence: silenceRequest,
      depart,
      complete,
      openDetail: (code) => setDetailCode(code),
      openLocationUpdate: (code) => setLocationCode(code),
      openRequestForm: (type) => setFormType(type),
      openInfo: () => {
        setTab("info");
        setInfoComposerOpen(true);
      },
      openTab: (next) => setTab(next),
    }),
    [acknowledge, silenceRequest, depart, complete]
  );

  const unreadCount = data?.notifications.filter((item) => item.status === "UNREAD").length ?? 0;
  const pushActive = pushState === "active";

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-950 text-white">
        <Spinner className="h-8 w-8 text-metro-yellow" />
        <div className="text-sm font-semibold">Opening {user.stationName} station console…</div>
        {loadError ? (
          <div className="max-w-sm rounded-xl bg-red-500/20 px-4 py-3 text-center text-xs text-red-100">
            {loadError}
            <button type="button" className="mt-2 block w-full rounded-lg bg-white/10 px-3 py-1.5 font-semibold" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <StationHeader
        user={user}
        tab={tab}
        onTab={setTab}
        unreadCount={unreadCount}
        liveStatus={live}
        soundEnabled={soundEnabled}
        pushActive={pushActive}
        now={now}
        onToggleSound={toggleSound}
        onTestAlarm={() => void testAlarm()}
        onLogout={() => void logout()}
      />

      {data.settings.demoMode ? (
        <div className="mx-auto mt-3 max-w-[1400px] px-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
            <Info className="h-5 w-5 text-sky-700" />
            <span className="font-semibold">
              Demonstration mode — station list, route sequence and requests are synthetic test data, not official DMRC data.
            </span>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mx-auto mt-3 max-w-[1400px] px-3 sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <WifiOff className="h-4 w-4" /> {loadError}
            <button type="button" className="ml-auto font-semibold underline" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!soundEnabled && !soundPromptDismissed ? (
        <div className="mx-auto mt-3 max-w-[1400px] px-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5">
            <BellRing className="h-5 w-5 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              Alarm sound is off. Enable sound to hear new request and three-station alarms.
            </span>
            <button type="button" className="btn-yellow btn-sm ml-auto" onClick={enableSound}>
              <Volume2 className="h-4 w-4" /> Enable sound
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm text-amber-900"
              onClick={() => setSoundPromptDismissed(true)}
              aria-label="Dismiss sound reminder"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto mt-3 max-w-[1400px] px-3 sm:px-5">
        {tab === "overview" ? (
          <OverviewTab
            user={user}
            data={data}
            api={api}
            busyCode={busyCode}
            onAckInfo={(infoCode) => void acknowledgeInfo(infoCode)}
          />
        ) : null}
        {tab === "requests" ? <RequestsTab user={user} data={data} api={api} busyCode={busyCode} /> : null}
        {tab === "tracking" ? <TrackingTab user={user} data={data} api={api} busyCode={busyCode} /> : null}
        {tab === "info" ? (
          <InfoTab
            user={user}
            notices={data.notices}
            notify={notify}
            composerOpen={infoComposerOpen}
            onOpenComposer={() => setInfoComposerOpen(true)}
            onCloseComposer={() => setInfoComposerOpen(false)}
            onChanged={() => void refresh()}
          />
        ) : null}
        {tab === "notifications" ? (
          <NotificationsTab
            notifications={data.notifications}
            api={api}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            onTestAlarm={() => void testAlarm()}
            onMarkRead={(notification, action) => void markNotification(notification, action)}
            onMarkAllRead={() => void markAllRead()}
            markAllBusy={markAllBusy}
            busyId={busyNotificationId}
            pushState={pushState}
            browserPermission={browserPermission}
            onEnableBrowser={() => void enableBrowserNotifications()}
            onEnablePush={() => void enablePush()}
            pushBusy={pushBusy}
          />
        ) : null}
      </main>

      <RequestFormModal
        open={!!formType}
        type={formType ?? "VISUALLY_IMPAIRED"}
        user={user}
        onClose={() => setFormType(null)}
        onCreated={onRequestCreated}
      />

      <RequestDetailModal
        code={detailCode}
        user={user}
        api={api}
        busy={!!detailCode && busyCode === detailCode}
        version={version}
        onClose={() => setDetailCode(null)}
      />

      <UpdateLocationModal
        code={locationCode}
        onClose={() => setLocationCode(null)}
        onUpdated={onTrainMoved}
        notify={notify}
      />

      {activeAlert ? (
        <AlarmOverlay
          alert={activeAlert}
          queueLength={alerts.length}
          user={user}
          api={api}
          soundEnabled={soundEnabled}
          onEnableSound={enableSound}
          onDismiss={(alert, mode) => {
            if (alert.kind === "TEST_ALARM" || alert.id <= 0) {
              setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
            } else {
              void markNotification(alert, mode);
            }
          }}
          onAcknowledgeInfo={(alert) => void acknowledgeBroadcast(alert)}
          busy={
            (!!busyCode && busyCode === activeAlert.requestId) ||
            (!!busyNotificationId && busyNotificationId === activeAlert.id)
          }
        />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
