"use client";

import { useEffect, useState } from "react";

export interface OrganizerEntryData {
  companyKey: string;
  resolvedName: string;
  prepped: boolean;
  interviewDate: string | null;
  confidence: number | null;
}

/**
 * Structured-only tracking for one company: prepped status, interview date,
 * confidence. No free-text notes — deliberately out of scope for this change
 * (see design.md Non-Goals).
 */
export function OrganizerPanel({
  companyKey,
  resolvedName,
}: {
  companyKey: string;
  resolvedName: string;
}) {
  const [prepped, setPrepped] = useState(false);
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
          setPrepped(existing.prepped);
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
      const response = await fetch("/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey,
          resolvedName,
          prepped,
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
    <section className="card">
      <h3>Your preparation tracker</h3>
      <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={prepped}
            onChange={(e) => setPrepped(e.target.checked)}
          />
          Prepped
        </label>

        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          Interview date
          <input
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
          />
        </label>

        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          Confidence
          <select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="secondary" onClick={() => void save()} disabled={saving}>
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
