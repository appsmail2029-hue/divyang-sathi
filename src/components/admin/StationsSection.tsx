"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, Upload, UserRound } from "lucide-react";
import { AlertBanner, Modal, Spinner } from "@/components/ui";
import { apiFetch, errorDetails, errorMessage, patchJson, postJson } from "@/lib/client-api";
import type { AdminApi, AdminStation } from "./admin-types";
import { ActivePill, EmptyRow, SectionError, SectionHeader, SectionLoading, TableShell } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

interface ImportResult {
  imported: number;
  created: number;
  updated: number;
  deactivated: number;
}

export default function StationsSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<{ stations: AdminStation[] }>(
    "/api/admin/stations",
    api.version
  );
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminStation | null>(null);
  const [form, setForm] = useState({ code: "", name: "", active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importDetails, setImportDetails] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const stations = data?.stations ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return stations;
    return stations.filter(
      (station) =>
        station.code.toLowerCase().includes(term) || station.name.toLowerCase().includes(term)
    );
  }, [data, query]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", active: true });
    setFormError("");
    setFormMode("create");
  };

  const openEdit = (station: AdminStation) => {
    setEditing(station);
    setForm({ code: station.code, name: station.name, active: station.active });
    setFormError("");
    setFormMode("edit");
  };

  const closeForm = () => {
    if (saving) return;
    setFormMode(null);
    setEditing(null);
  };

  async function saveStation(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        await patchJson(`/api/admin/stations/${editing.id}`, form);
        api.notify("success", `Station ${form.code} updated.`);
      } else {
        await postJson("/api/admin/stations", form);
        api.notify("success", `Station ${form.code} created.`);
      }
      setFormMode(null);
      setEditing(null);
      api.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(station: AdminStation) {
    if (
      station.active &&
      !window.confirm(
        `Deactivate ${station.name}? Its staff sessions will be signed out and it will be removed from new request choices.`
      )
    ) {
      return;
    }
    setBusyId(station.id);
    try {
      await patchJson(`/api/admin/stations/${station.id}`, {
        code: station.code,
        name: station.name,
        active: !station.active,
      });
      api.notify("success", `${station.name} ${station.active ? "deactivated" : "activated"}.`);
      api.refresh();
    } catch (err) {
      api.notify("error", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function runImport(event: React.FormEvent) {
    event.preventDefault();
    setImportError("");
    setImportDetails([]);
    if (!file) {
      setImportError("Choose a CSV or Excel file to import.");
      return;
    }
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await apiFetch<ImportResult>("/api/admin/stations/import", {
        method: "POST",
        body,
      });
      setImportOpen(false);
      setFile(null);
      api.notify(
        "success",
        `Imported ${result.imported} stations (created ${result.created}, updated ${result.updated}, deactivated ${result.deactivated}).`
      );
      api.refresh();
    } catch (err) {
      setImportError(errorMessage(err));
      setImportDetails(errorDetails(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Station master"
        description="Station code, name, active status and route positions. CSV/XLSX imports replace the active station list and both route sequences."
        actions={
          <>
            <a href="/api/admin/stations/template" className="btn-outline btn-sm bg-white" download>
              <Download className="h-4 w-4" /> CSV template
            </a>
            <button
              type="button"
              onClick={() => {
                setImportError("");
                setImportDetails([]);
                setImportOpen(true);
              }}
              className="btn-outline btn-sm bg-white"
            >
              <Upload className="h-4 w-4" /> Import file
            </button>
            <button type="button" onClick={openCreate} className="btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Add station
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input min-h-[42px] pl-9"
            placeholder="Search station code or name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search stations"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing {filtered.length} of {data?.stations.length ?? 0} stations
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SectionLoading label="Loading stations…" />
      ) : (
        <TableShell>
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th className="th">Code</th>
                <th className="th">Station name</th>
                <th className="th">Status</th>
                <th className="th">+ Sequence</th>
                <th className="th">- Sequence</th>
                <th className="th">Accounts</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((station) => (
                  <tr key={station.id}>
                    <td className="td font-mono text-xs font-bold text-navy-900">{station.code}</td>
                    <td className="td font-semibold text-navy-950">{station.name}</td>
                    <td className="td">
                      <ActivePill active={station.active} />
                    </td>
                    <td className="td text-sm">
                      {station.plusSeq ?? <span className="text-slate-400">Not set</span>}
                    </td>
                    <td className="td text-sm">
                      {station.minusSeq ?? <span className="text-slate-400">Not set</span>}
                    </td>
                    <td className="td text-sm">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <UserRound className="h-3.5 w-3.5" /> {station.userCount}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => openEdit(station)} className="btn-outline btn-sm">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(station)}
                          disabled={busyId === station.id}
                          className={station.active ? "btn-outline btn-sm text-red-700" : "btn-outline btn-sm text-emerald-700"}
                        >
                          {busyId === station.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                          {station.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={7}>No stations match the search.</EmptyRow>
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <p className="text-xs text-slate-500">
        Active stations must appear in both route sequences. Imported files are validated before any change is written.
      </p>

      <Modal
        open={formMode !== null}
        onClose={closeForm}
        title={formMode === "edit" ? `Edit ${editing?.name ?? "station"}` : "Add station"}
        subtitle="Codes must be 2–12 letters, digits, hyphens or underscores and unique."
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="station-form" className="btn-primary" disabled={saving}>
              {saving ? <Spinner /> : null}
              {saving ? "Saving…" : formMode === "edit" ? "Save changes" : "Create station"}
            </button>
          </>
        }
      >
        <form id="station-form" onSubmit={saveStation} className="space-y-4">
          <div>
            <label htmlFor="station-code" className="label">
              Station code
            </label>
            <input
              id="station-code"
              className="input uppercase"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              maxLength={12}
              required
            />
          </div>
          <div>
            <label htmlFor="station-name" className="label">
              Station name
            </label>
            <input
              id="station-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              maxLength={90}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-5 w-5 accent-[#0b2447]"
            />
            Station is active and available for requests
          </label>
          {formError ? <AlertBanner tone="danger">{formError}</AlertBanner> : null}
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => (importing ? undefined : setImportOpen(false))}
        title="Import verified station list"
        subtitle="Upload a CSV or XLSX file with station_code, station_name, plus_sequence, minus_sequence and active_status."
        size="md"
        dismissible={!importing}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </button>
            <button type="submit" form="station-import-form" className="btn-primary" disabled={importing}>
              {importing ? <Spinner /> : <Upload className="h-4 w-4" />}
              {importing ? "Importing…" : "Import stations"}
            </button>
          </>
        }
      >
        <form id="station-import-form" onSubmit={runImport} className="space-y-4">
          <AlertBanner tone="warning" title="This replaces the current route data">
            Any station not present in the uploaded file will be deactivated. Both + Circular and - Circular sequences
            are rebuilt from the file. Verify the official Pink Line order before importing — the bundled dataset is
            demonstration data only.
          </AlertBanner>
          <div>
            <label htmlFor="station-file" className="label">
              Station file (CSV or XLSX, max 5 MB)
            </label>
            <input
              id="station-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              required
            />
            {file ? <p className="field-help">{file.name} · {Math.round(file.size / 1024)} KB</p> : null}
          </div>
          <a href="/api/admin/stations/template" download className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
            <Download className="h-4 w-4" /> Download the CSV template
          </a>
          {importError ? (
            <div>
              <AlertBanner tone="danger">{importError}</AlertBanner>
              {importDetails.length ? (
                <ul className="mt-2 list-inside list-disc rounded-lg bg-red-50 px-4 py-2 text-xs text-red-800">
                  {importDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
