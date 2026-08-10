"use client";

import { useEffect, useState } from "react";
import { STATUS_META, STATUS_ORDER } from "@/lib/organizerStatus";
import type { OrganizerStatus } from "@/lib/storage";

export interface OrganizerEntryData {
  companyKey: string;
  resolvedName: string;
  status: OrganizerStatus;
  bookmarked: boolean;
  interviewDate: string | null;
  confidence: number | null;
}

/**
 * Structured-only tracking for one company: preparation status, interview
 * date, confidence. No free-text notes — deliberately out of scope for this
 * change (see design.md Non-Goals).
 *
 * Bookmark state lives on the same storage row but is edited independently
 * via BriefView's star button, which sits on the same page as this panel.
 * Deliberately NOT held in this component's state: two components each
 * holding their own stale copy of `bookmarked` and posting it back on save
 * is exactly how one silently clobbers the other's change (last write
 * wins). Instead, `save()` re-fetches the current `bookmarked` value at the
 * moment it saves, so it can never overwrite a star click that happened
 * after this panel's own initial load.
 */
export function OrganizerPanel({
  companyKey,
  resolvedName,
}: {
  companyKey: string;
  resolvedName: string;
}) {
  const [status, setStatus] = useState<OrganizerStatus>("tracking");
  const [interviewDate, setInterviewDate] = useState("");
  const [confidence, setConfidence] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizer")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entries?: OrganizerEntryData[] } | null) => {
        if (cancelled || !data?.entries) return;
        const existing = data.entries.find((e) => e.companyKey === companyKey);
        if (existing) {
          setStatus(existing.status);
          setInterviewDate(existing.interviewDate ?? "");
          setConfidence(existing.confidence ? String(existing.confidence) : "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const current: { entries?: OrganizerEntryData[] } | null = await fetch("/api/organizer").then((res) =>
        res.ok ? res.json() : null,
      );
      const existing = current?.entries?.find((e) => e.companyKey === companyKey);

      const response = await fetch("/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey,
          resolvedName,
          status,
          bookmarked: existing?.bookmarked ?? false,
          interviewDate: interviewDate || null,
          confidence: confidence ? Number(confidence) : null,
        }),
      });
      if (response.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className="bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-1 p-6 flex flex-col gap-3">
      <h3 className="text-lg font-bold text-on-surface">Your preparation tracker</h3>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-on-surface text-sm font-semibold">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrganizerStatus)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide cursor-pointer ${STATUS_META[status].chip}`}
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-on-surface text-sm font-semibold">
          Interview date
          <input
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-on-surface text-sm font-semibold">
          Confidence
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-sm"
          >
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold shadow-elevation-1 active:scale-[0.97] transition-[filter,box-shadow,transform,background-color] disabled:opacity-50 ${
            saved
              ? "bg-secondary-container text-on-secondary-container animate-pulse-once"
              : "bg-primary text-on-primary hover:brightness-95 hover:shadow-elevation-2"
          }`}
        >
          {saved && <span className="material-symbols-outlined text-[16px]">check</span>}
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
