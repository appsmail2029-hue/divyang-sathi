"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/components/ui";

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold text-navy-950">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm font-medium text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="font-bold">Could not load this section</div>
          <p className="mt-0.5">{message}</p>
        </div>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn-outline btn-sm bg-white">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "chip",
        active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}
