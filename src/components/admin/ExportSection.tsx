"use client";

import { Database, FileJson, HardDriveDownload, ShieldCheck } from "lucide-react";
import { SectionHeader } from "./admin-ui";

const TABLES = [
  "stations",
  "route_sequences",
  "users (without password hashes)",
  "assistance_requests",
  "request_acknowledgements",
  "train_movements",
  "notifications",
  "other_information",
  "information_acknowledgements",
  "audit_logs",
  "settings",
  "push_subscriptions",
];

export default function ExportSection() {
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Backup & export"
        description="Download a portable snapshot of the operational database for archiving, analysis or migration."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-navy-700" />
            <h3 className="text-sm font-bold text-navy-950">JSON export</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Human-readable snapshot of every table with password hashes removed. Suitable for audits, handover and
            importing into another environment.
          </p>
          <a href="/api/admin/export?format=json" download={`metro-assist-${stamp}.json`} className="btn-primary btn-sm mt-4">
            <HardDriveDownload className="h-4 w-4" /> Download JSON
          </a>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-navy-700" />
            <h3 className="text-sm font-bold text-navy-950">SQLite database</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Full binary copy after a WAL checkpoint. Contains password hashes and push subscriptions — store it as
            sensitive material and never commit it to source control.
          </p>
          <a href="/api/admin/export?format=sqlite" download={`metro-assist-${stamp}.db`} className="btn-outline btn-sm mt-4 bg-white">
            <Database className="h-4 w-4" /> Download SQLite
          </a>
        </section>
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <h3 className="text-sm font-bold text-navy-950">Export contents</h3>
        </div>
        <div className="mt-3 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          {TABLES.map((table) => (
            <div key={table} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-metro-yellow" />
              <span className="font-mono text-xs">{table}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The JSON export also records the application name, export timestamp and the independent-prototype notice. The
          bundled dataset is synthetic demonstration data unless replaced by the administrator.
        </p>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-bold text-navy-950">Operational backup guidance</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-slate-600">
          <li>Schedule the JSON export at least once per shift and store it outside the application host.</li>
          <li>Keep the SQLite snapshot only where access is restricted; it contains credential material.</li>
          <li>Before deployment, replace the demonstration station list via the official CSV import and rotate all passwords.</li>
          <li>For serverless hosting, mount a persistent volume for <span className="kbd">data/</span> so the database survives redeploys.</li>
        </ol>
      </section>
    </div>
  );
}
