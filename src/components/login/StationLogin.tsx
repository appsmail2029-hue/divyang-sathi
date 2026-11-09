"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, MapPin, ShieldAlert, Smartphone } from "lucide-react";
import { apiFetch, errorMessage, postJson } from "@/lib/client-api";
import type { SessionUser, StationOption } from "@/lib/types";
import { AlertBanner, Spinner } from "@/components/ui";

export default function StationLogin() {
  const router = useRouter();
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [stationId, setStationId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<{ stations: StationOption[] }>("/api/auth/stations")
      .then((data) => {
        if (!active) return;
        setStations(data.stations);
        if (data.stations.length === 1) setStationId(String(data.stations[0].id));
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoadingStations(false));
    return () => {
      active = false;
    };
  }, []);

  const fillDemo = (match: string) => {
    const station = stations.find((s) => s.name.toLowerCase().includes(match));
    if (station) {
      setStationId(String(station.id));
      setPassword("12345");
      setError("");
    }
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!stationId || !password) {
      setError("Select your station and enter the station password.");
      return;
    }
    setSubmitting(true);
    try {
      await postJson<{ user: SessionUser }>("/api/auth/login", {
        portal: "station",
        stationId: Number(stationId),
        password,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-700">
          <MapPin className="h-3.5 w-3.5" /> Station access
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-navy-950">Station sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select your assigned Pink Line station and enter your station password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="station" className="label">
            Station
          </label>
          <select
            id="station"
            className="input"
            value={stationId}
            onChange={(event) => setStationId(event.target.value)}
            disabled={loadingStations}
            required
          >
            <option value="">{loadingStations ? "Loading stations…" : "Select your station"}</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} ({station.code})
              </option>
            ))}
          </select>
          {!loadingStations && !stations.length ? (
            <p className="field-help text-amber-700">
              No station accounts exist yet. Ask the administrator to create one in the{" "}
              <Link href="/admin/login" className="font-semibold underline">
                admin portal
              </Link>
              .
            </p>
          ) : null}
          {!loadingStations && stations.length ? (
            <p className="field-help">
              {stations.length} Pink Line stations are connected for network-wide coordination.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Station password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pl-11 pr-12"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
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

        <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting || loadingStations}>
          {submitting ? <Spinner /> : <ArrowRight className="h-5 w-5" />}
          {submitting ? "Signing in…" : "Sign in to station"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-xs leading-relaxed text-amber-900">
            <div className="font-bold uppercase tracking-wide">Prototype credentials</div>
            <p className="mt-1">
              Every station account uses the temporary password <span className="kbd">12345</span>. Replace every
              station password with administrator-issued credentials before deployment.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => fillDemo("anand vihar")} className="btn-outline btn-sm bg-white">
                <KeyRound className="h-3.5 w-3.5" /> Anand Vihar
              </button>
              <button type="button" onClick={() => fillDemo("lajpat nagar")} className="btn-outline btn-sm bg-white">
                <KeyRound className="h-3.5 w-3.5" /> Lajpat Nagar
              </button>
              <button type="button" onClick={() => fillDemo("rajouri garden")} className="btn-outline btn-sm bg-white">
                <KeyRound className="h-3.5 w-3.5" /> Rajouri Garden
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>Independent prototype — not an official DMRC system.</span>
        <span className="flex items-center gap-3">
          <a
            href="/downloads/METRO-ASSIST.apk"
            download
            className="inline-flex items-center gap-1 font-semibold text-navy-700 hover:underline"
          >
            Android app <Smartphone className="h-3.5 w-3.5" />
          </a>
          <Link href="/admin/login" className="inline-flex items-center gap-1 font-semibold text-navy-700 hover:underline">
            Admin portal <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </span>
      </div>
    </div>
  );
}
