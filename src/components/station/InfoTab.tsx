"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Megaphone,
  Send,
  Trash2,
} from "lucide-react";
import {
  AlertBanner,
  CategoryPill,
  EmptyState,
  Modal,
  Spinner,
  cn,
  formatDateTime,
} from "@/components/ui";
import { apiFetch, errorMessage, postJson } from "@/lib/client-api";
import type { InfoCategory, OtherInfo, SessionUser } from "@/lib/types";
import { INFO_LABEL } from "@/lib/types";
import type { PushToast } from "./station-types";

const CATEGORIES: Array<{ value: InfoCategory; label: string; description: string }> = [
  { value: "LOST_FOUND", label: "Lost & Found", description: "Bag, documents, phone or valuables found or reported missing" },
  { value: "SEPARATE_PASSENGER", label: "Separate Passenger", description: "A passenger separated from family, group or caregiver" },
  { value: "OTHER", label: "Other", description: "Any other station information requiring a network-wide notice" },
];

export default function InfoTab({
  user,
  notices,
  notify,
  composerOpen,
  onOpenComposer,
  onCloseComposer,
  onChanged,
}: {
  user: SessionUser;
  notices: OtherInfo[];
  notify: PushToast;
  composerOpen: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onChanged: () => void;
}) {
  const [category, setCategory] = useState<InfoCategory>("LOST_FOUND");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [closedNotices, setClosedNotices] = useState<OtherInfo[] | null>(null);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!composerOpen) return;
    setCategory("LOST_FOUND");
    setDescription("");
    setFile(null);
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, [composerOpen]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickFile(next: File | null) {
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(next.type)) {
      setError("Attach a JPG, PNG, WEBP or GIF image.");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (description.trim().length < 5) {
      setError("Please provide a description (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const upload = await apiFetch<{ url: string }>("/api/upload", { method: "POST", body: form });
        imageUrl = upload.url;
      }
      const result = await postJson<{ info: OtherInfo; notified: number }>("/api/info", {
        category,
        description: description.trim(),
        imageUrl,
      });
      notify(
        "success",
        `${INFO_LABEL[result.info.category]} notice ${result.info.infoCode} broadcast to ${result.notified} active station(s).`
      );
      onCloseComposer();
      onChanged();
      if (showClosed) setClosedNotices(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function acknowledge(infoCode: string) {
    setAckBusy(infoCode);
    try {
      await postJson(`/api/info/${encodeURIComponent(infoCode)}/ack`);
      notify("success", `Receipt acknowledged for notice ${infoCode}.`);
      setClosedNotices((current) =>
        current
          ? current.map((notice) =>
              notice.infoCode === infoCode
                ? { ...notice, acknowledgedByMe: true, acknowledgedStations: notice.acknowledgedStations + 1 }
                : notice
            )
          : current
      );
      onChanged();
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setAckBusy(null);
    }
  }

  async function toggleClosed() {
    const next = !showClosed;
    setShowClosed(next);
    if (next && !closedNotices) {
      setLoadingClosed(true);
      try {
        const data = await apiFetch<{ notices: OtherInfo[] }>("/api/info?includeClosed=1");
        setClosedNotices(data.notices);
      } catch (err) {
        notify("error", errorMessage(err));
      } finally {
        setLoadingClosed(false);
      }
    }
  }

  const list = showClosed ? closedNotices ?? [] : notices;

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-navy-950">Other information & notice board</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Lost &amp; Found, separate passenger and other notices are broadcast to all active Pink Line stations and
              saved on the common notice board. Administrators may close outdated notices.
            </p>
          </div>
          <button type="button" className="btn-yellow" onClick={onOpenComposer}>
            <Megaphone className="h-5 w-5" /> Broadcast information
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (showClosed) void toggleClosed();
            }}
            className={cn("tab", !showClosed && "tab-active")}
          >
            Open notices ({notices.filter((n) => n.status === "OPEN").length})
          </button>
          <button type="button" onClick={() => { if (!showClosed) void toggleClosed(); }} className={cn("tab", showClosed && "tab-active")}>
            All notices {loadingClosed ? <Spinner className="h-4 w-4" /> : null}
          </button>
          <span className="ml-auto text-[11px] text-slate-400">Broadcast origin: {user.stationName}</span>
        </div>
      </div>

      {list.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((notice) => (
            <article
              key={notice.infoCode}
              className={cn(
                "card overflow-hidden",
                notice.status === "CLOSED" && "opacity-70"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <CategoryPill category={notice.category} />
                <span className="font-mono text-[11px] font-bold text-slate-500">{notice.infoCode}</span>
                {notice.status === "CLOSED" ? (
                  <span className="chip bg-slate-200 text-slate-600">Closed</span>
                ) : notice.acknowledgedByMe ? (
                  <span className="chip bg-emerald-100 text-emerald-800">Received</span>
                ) : (
                  <span className="chip bg-amber-100 text-amber-800">Action needed</span>
                )}
                <span className="ml-auto text-[11px] text-slate-400">{formatDateTime(notice.createdAt)}</span>
              </div>
              <div className="flex gap-3 px-4 py-3">
                {notice.imageUrl ? (
                  <a
                    href={notice.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={notice.imageUrl} alt="Attached notice image" className="h-full w-full object-cover" />
                  </a>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-sm text-navy-900">{notice.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-navy-700">{notice.originStation}</span>
                    <span>·</span>
                    <span>{notice.createdBy}</span>
                    <span>·</span>
                    <span>{notice.acknowledgedStations} station acknowledgement(s)</span>
                  </div>
                </div>
              </div>
              {notice.status === "OPEN" ? (
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
                  <span className="text-[11px] text-slate-500">
                    {notice.acknowledgedByMe ? "Your station has acknowledged receipt." : "Acknowledge receipt to close this alert on your station."}
                  </span>
                  {notice.acknowledgedByMe ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <button
                      type="button"
                      className="btn-yellow btn-sm"
                      disabled={ackBusy === notice.infoCode}
                      onClick={() => acknowledge(notice.infoCode)}
                    >
                      {ackBusy === notice.infoCode ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      Acknowledge receipt
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title={showClosed ? "No notices recorded" : "No open notices"}
            description="Broadcast Lost & Found, separate passenger or other station information to every active station on the line."
          />
        </div>
      )}

      <Modal
        open={composerOpen}
        onClose={onCloseComposer}
        title="Broadcast other information"
        subtitle={`Originating station: ${user.stationName} (${user.stationCode}) · delivered to every active station`}
        icon={<Megaphone className="h-6 w-6" />}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={onCloseComposer} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="info-form" className="btn-yellow" disabled={submitting}>
              {submitting ? <Spinner /> : <Send className="h-5 w-5" />}
              {submitting ? "Broadcasting…" : "Broadcast to all stations"}
            </button>
          </>
        }
      >
        <form id="info-form" onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className="label">Category</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {CATEGORIES.map((item) => (
                <label
                  key={item.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors",
                    category === item.value ? "border-navy-700 bg-navy-50" : "border-slate-200 bg-white hover:border-navy-300"
                  )}
                >
                  <input
                    type="radio"
                    name="info-category"
                    value={item.value}
                    checked={category === item.value}
                    onChange={() => setCategory(item.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-extrabold text-navy-950">{item.label}</span>
                  <span className="text-[11px] leading-snug text-slate-500">{item.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="info-description" className="label">
              Description
            </label>
            <textarea
              id="info-description"
              className="input min-h-[130px] resize-y"
              value={description}
              maxLength={1200}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="For example: Blue bag containing important documents found near Platform 2."
              required
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>Describe the item, passenger or situation clearly. Avoid personal data.</span>
              <span>{description.length}/1200</span>
            </div>
          </div>

          <div>
            <span className="label">Optional image attachment</span>
            {preview ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Selected attachment preview" className="h-20 w-20 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-navy-900">{file?.name}</div>
                  <div className="text-[11px] text-slate-500">{file ? Math.ceil(file.size / 1024) : 0} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    pickFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="btn-ghost btn-sm text-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
            ) : (
              <label className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-navy-400 hover:bg-navy-50">
                <ImagePlus className="h-6 w-6 text-slate-400" />
                <span className="text-sm font-semibold text-navy-800">Attach a photo (optional)</span>
                <span className="text-[11px] text-slate-500">JPG, PNG, WEBP or GIF · max 5 MB</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => pickFile(event.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This notice will be pushed immediately to staff at all active stations and recorded in the shared notice
              board. Use only authorised, non-sensitive information. This prototype must not be used with real passenger
              data.
            </span>
          </div>

          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
        </form>
      </Modal>
    </div>
  );
}
