"use client";

import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { AlertBanner, Modal, Spinner, formatDateTime } from "@/components/ui";
import { errorMessage, patchJson, postJson } from "@/lib/client-api";
import type { AdminApi, AdminStation, AdminUser } from "./admin-types";
import { ActivePill, EmptyRow, SectionError, SectionHeader, SectionLoading, TableShell } from "./admin-ui";
import { useAdminData } from "./use-admin-data";

type ModalState = { kind: "create" } | { kind: "edit"; user: AdminUser } | { kind: "reset"; user: AdminUser } | null;

interface UserForm {
  username: string;
  displayName: string;
  role: "admin" | "station";
  stationId: string;
  active: boolean;
  password: string;
  confirm: string;
}

const EMPTY_FORM: UserForm = {
  username: "",
  displayName: "",
  role: "station",
  stationId: "",
  active: true,
  password: "",
  confirm: "",
};

export default function UsersSection({ api }: { api: AdminApi }) {
  const { data, error, loading, reload } = useAdminData<{ users: AdminUser[]; stations: AdminStation[] }>(
    "/api/admin/users",
    api.version
  );
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "station">("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const stations = useMemo(
    () => [...(data?.stations ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!term) return true;
      return (
        user.username.toLowerCase().includes(term) ||
        user.displayName.toLowerCase().includes(term) ||
        (user.stationName ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, query, roleFilter]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal({ kind: "create" });
  };

  const openEdit = (user: AdminUser) => {
    setForm({
      ...EMPTY_FORM,
      displayName: user.displayName,
      role: user.role,
      stationId: user.stationId ? String(user.stationId) : "",
      active: user.active,
    });
    setFormError("");
    setModal({ kind: "edit", user });
  };

  const openReset = (user: AdminUser) => {
    setForm({ ...EMPTY_FORM, password: "", confirm: "" });
    setFormError("");
    setModal({ kind: "reset", user });
  };

  const close = () => {
    if (saving) return;
    setModal(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!modal) return;
    setFormError("");
    const needsPassword = modal.kind === "create" || modal.kind === "reset";
    if (needsPassword) {
      if (form.password.length < 4) {
        setFormError("Password must be at least 4 characters.");
        return;
      }
      if (form.password !== form.confirm) {
        setFormError("Passwords do not match.");
        return;
      }
    }
    setSaving(true);
    try {
      if (modal.kind === "create") {
        await postJson("/api/admin/users", {
          username: form.username,
          displayName: form.displayName,
          role: form.role,
          stationId: form.stationId ? Number(form.stationId) : null,
          password: form.password,
        });
        api.notify("success", `Account ${form.username} created.`);
      } else if (modal.kind === "edit") {
        await patchJson(`/api/admin/users/${modal.user.id}`, {
          displayName: form.displayName,
          role: form.role,
          stationId: form.stationId ? Number(form.stationId) : null,
          active: form.active,
        });
        api.notify("success", `Account ${modal.user.username} updated.`);
      } else {
        await postJson(`/api/admin/users/${modal.user.id}/reset-password`, { password: form.password });
        api.notify("success", `Password reset for ${modal.user.username}. Existing sessions were signed out.`);
      }
      setModal(null);
      api.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <SectionLoading label="Loading accounts…" />;
  if (error) return <SectionError message={error} onRetry={reload} />;
  if (!data) return null;

  const title =
    modal?.kind === "create"
      ? "Create account"
      : modal?.kind === "edit"
        ? `Edit ${modal.user.username}`
        : modal?.kind === "reset"
          ? `Reset password for ${modal.user.username}`
          : "";

  return (
    <div className="space-y-4">
      <SectionHeader
        title="User accounts"
        description="Create station staff or administrator accounts, assign stations, activate or deactivate access and reset passwords."
        actions={
          <button type="button" onClick={openCreate} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" /> Create account
          </button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input min-h-[42px] pl-9"
              placeholder="Search name, username or station"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search accounts"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["all", "station", "admin"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                  roleFilter === role ? "bg-metro-navy text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {role === "all" ? "All roles" : role}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing {filtered.length} of {data.users.length} accounts
        </div>
      </div>

      <TableShell>
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th className="th">Account</th>
              <th className="th">Role</th>
              <th className="th">Station</th>
              <th className="th">Status</th>
              <th className="th">Password</th>
              <th className="th">Created</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((user) => (
                <tr key={user.id}>
                  <td className="td">
                    <div className="font-semibold text-navy-950">{user.displayName}</div>
                    <div className="text-xs font-mono text-slate-500">{user.username}</div>
                  </td>
                  <td className="td">
                    <span
                      className={`chip ${
                        user.role === "admin" ? "bg-navy-100 text-navy-800" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {user.role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="td text-sm text-slate-600">{user.stationName ?? "—"}</td>
                  <td className="td">
                    <ActivePill active={user.active} />
                  </td>
                  <td className="td text-xs">
                    {user.mustChangePassword ? (
                      <span className="chip bg-amber-100 text-amber-800">Change required</span>
                    ) : (
                      <span className="text-slate-400">Set by admin</span>
                    )}
                  </td>
                  <td className="td text-xs text-slate-500">{formatDateTime(user.createdAt)}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => openEdit(user)} className="btn-outline btn-sm">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => openReset(user)} className="btn-outline btn-sm">
                        <KeyRound className="h-3.5 w-3.5" /> Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={7}>No accounts match the filters.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>

      <p className="text-xs text-slate-500">
        Station accounts are limited to their own station for acknowledgement and train movement. Password resets and
        role changes immediately revoke existing sessions.
      </p>

      <Modal
        open={modal !== null}
        onClose={close}
        title={title}
        subtitle={
          modal?.kind === "reset"
            ? "The account will be forced to change this password after the next sign-in."
            : "Usernames are unique and cannot be changed after creation."
        }
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="user-form" className="btn-primary" disabled={saving}>
              {saving ? <Spinner /> : null}
              {saving
                ? "Saving…"
                : modal?.kind === "create"
                  ? "Create account"
                  : modal?.kind === "edit"
                    ? "Save changes"
                    : "Reset password"}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="space-y-4">
          {modal?.kind === "create" ? (
            <>
              <div>
                <label htmlFor="user-name" className="label">
                  Username
                </label>
                <input
                  id="user-name"
                  className="input"
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                  autoCapitalize="none"
                  autoComplete="off"
                  required
                />
                <p className="field-help">3–31 lowercase letters, digits, dot, underscore or hyphen.</p>
              </div>
              <div>
                <label htmlFor="user-display" className="label">
                  Display name
                </label>
                <input
                  id="user-display"
                  className="input"
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  required
                />
              </div>
            </>
          ) : null}

          {modal?.kind !== "reset" ? (
            <>
              <div>
                <span className="label">Role</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["station", "admin"] as const).map((role) => (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold ${
                        form.role === role ? "border-navy-700 bg-navy-50 text-navy-950" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={form.role === role}
                        onChange={() => setForm((prev) => ({ ...prev, role, stationId: role === "admin" ? "" : prev.stationId }))}
                        className="h-4 w-4 accent-[#0b2447]"
                      />
                      {role === "station" ? "Station staff" : "Administrator"}
                    </label>
                  ))}
                </div>
              </div>

              {form.role === "station" ? (
                <div>
                  <label htmlFor="user-station" className="label">
                    Assigned station
                  </label>
                  <select
                    id="user-station"
                    className="input"
                    value={form.stationId}
                    onChange={(event) => setForm((prev) => ({ ...prev, stationId: event.target.value }))}
                    required
                  >
                    <option value="">Select station</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name} ({station.code}){station.active ? "" : " — inactive"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {modal?.kind === "edit" ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-5 w-5 accent-[#0b2447]"
                  />
                  Account is active
                </label>
              ) : null}
            </>
          ) : null}

          {modal?.kind === "create" || modal?.kind === "reset" ? (
            <>
              <div>
                <label htmlFor="user-password" className="label">
                  {modal.kind === "reset" ? "New password" : "Initial password"}
                </label>
                <input
                  id="user-password"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="new-password"
                  minLength={4}
                  required
                />
              </div>
              <div>
                <label htmlFor="user-confirm" className="label">
                  Confirm password
                </label>
                <input
                  id="user-confirm"
                  type="password"
                  className="input"
                  value={form.confirm}
                  onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  autoComplete="new-password"
                  minLength={4}
                  required
                />
              </div>
            </>
          ) : null}

          {formError ? <AlertBanner tone="danger">{formError}</AlertBanner> : null}
        </form>
      </Modal>
    </div>
  );
}
