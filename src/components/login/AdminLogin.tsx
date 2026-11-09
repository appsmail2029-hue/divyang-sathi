"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { errorMessage, postJson } from "@/lib/client-api";
import type { SessionUser } from "@/lib/types";
import { AlertBanner, Spinner } from "@/components/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await postJson<{ user: SessionUser }>("/api/auth/login", {
        portal: "admin",
        username,
        password,
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card border-t-4 border-t-metro-yellow p-6 sm:p-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Administrator portal
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-navy-950">Administrator sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage stations, routes, accounts, reports and system alarms.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-username" className="label">
            Username
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-username"
              className="input pl-11"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="admin-password" className="label">
            Password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              className="input pl-11 pr-12"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter administrator password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

        <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? <Spinner /> : <ArrowRight className="h-5 w-5" />}
          {submitting ? "Verifying…" : "Enter admin portal"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <div className="font-bold uppercase tracking-wide text-slate-700">Initial local setup</div>
        <p className="mt-1">
          The first administrator is created from <span className="kbd">ADMIN_USERNAME</span> and{" "}
          <span className="kbd">ADMIN_PASSWORD</span> in <span className="kbd">.env.local</span>. The prototype
          default is <span className="kbd">admin</span> / <span className="kbd">Admin@12345</span>.
        </p>
        <button
          type="button"
          className="btn-outline btn-sm mt-2 bg-white"
          onClick={() => {
            setUsername("admin");
            setPassword("Admin@12345");
          }}
        >
          Fill prototype administrator credentials
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-navy-700 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to station sign in
        </Link>
        <a
          href="/downloads/METRO-ASSIST.apk"
          download
          className="inline-flex items-center gap-1 font-semibold text-navy-700 hover:underline"
        >
          Android app (APK) <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
