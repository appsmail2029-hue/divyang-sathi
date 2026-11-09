"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import type {
  AssistanceType,
  Direction,
  InfoCategory,
  NotificationPriority,
  RequestStatus,
} from "@/lib/types";
import { ASSISTANCE_LABEL, DIRECTION_LABEL, INFO_LABEL, STATUS_LABEL } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACKNOWLEDGED: "bg-sky-100 text-sky-800",
  DEPARTED: "bg-indigo-100 text-indigo-800",
  IN_TRANSIT: "bg-violet-100 text-violet-800",
  ARRIVED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={cn("chip", STATUS_STYLES[status])}>{STATUS_LABEL[status]}</span>;
}

export function TypePill({ type }: { type: AssistanceType }) {
  return (
    <span
      className={cn(
        "chip",
        type === "VISUALLY_IMPAIRED" ? "bg-sky-50 text-sky-800" : "bg-violet-50 text-violet-800"
      )}
    >
      {ASSISTANCE_LABEL[type]}
    </span>
  );
}

export function DirectionPill({ direction }: { direction: Direction }) {
  return (
    <span
      className={cn(
        "chip",
        direction === "+" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"
      )}
    >
      {DIRECTION_LABEL[direction]}
    </span>
  );
}

export function CategoryPill({ category }: { category: InfoCategory }) {
  const styles: Record<InfoCategory, string> = {
    LOST_FOUND: "bg-amber-100 text-amber-800",
    SEPARATE_PASSENGER: "bg-sky-100 text-sky-800",
    OTHER: "bg-slate-200 text-slate-700",
  };
  return <span className={cn("chip", styles[category])}>{INFO_LABEL[category]}</span>;
}

export function PriorityBadge({ priority }: { priority: NotificationPriority }) {
  const styles: Record<NotificationPriority, string> = {
    NORMAL: "bg-slate-100 text-slate-600",
    HIGH: "bg-amber-100 text-amber-800",
    CRITICAL: "bg-red-100 text-red-800",
  };
  return <span className={cn("chip", styles[priority])}>{priority}</span>;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="mb-1 text-slate-300">{icon}</div> : null}
      <div className="text-base font-semibold text-navy-900">{title}</div>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "navy",
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "navy" | "amber" | "sky" | "violet" | "green" | "red";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy-50 text-navy-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  const sizes = { sm: "sm:max-w-md", md: "sm:max-w-2xl", lg: "sm:max-w-4xl", xl: "sm:max-w-6xl" };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className={cn("modal-panel", sizes[size])} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          {icon ? <div className="mt-0.5 shrink-0 text-navy-700">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-navy-950">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {dismissible ? (
            <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2" aria-label="Close dialog">
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type ToastKind = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss(t.id), t.kind === "error" ? 8000 : 4500)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  const styles: Record<ToastKind, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  };
  const icons: Record<ToastKind, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
    error: <XCircle className="h-5 w-5 shrink-0 text-red-600" />,
    info: <Info className="h-5 w-5 shrink-0 text-sky-600" />,
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg animate-slideUp",
            styles[toast.kind]
          )}
          role="status"
        >
          {icons[toast.kind]}
          <span className="flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded p-1 hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AlertBanner({
  tone = "warning",
  title,
  children,
}: {
  tone?: "warning" | "danger" | "info" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", styles[tone])}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        {title ? <div className="font-bold">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const IST = "Asia/Kolkata";

export function formatDateTime(iso: string | null | undefined, withSeconds = false) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12: true,
    timeZone: IST,
  }).format(date);
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(date);
}

export function formatDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: IST,
  }).format(date);
}

export function formatClock(dateMs: number) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(new Date(dateMs));
}

export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const diff = now - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDateTime(iso);
}

export function etaMinutes(remaining: number, secondsPerStation: number) {
  const total = Math.max(0, remaining) * secondsPerStation;
  if (total <= 0) return "Arrived";
  const minutes = Math.ceil(total / 60);
  return `${minutes} min`;
}

export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
