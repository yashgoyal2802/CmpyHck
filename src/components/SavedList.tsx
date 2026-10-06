"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrganizerEntry } from "@/lib/storage";

interface OrganizerEntrySummary {
  companyKey: string;
  status?: string;
  interviewDate: string | null;
  confidence: number | null;
}

/**
 * Removing a saved company only unbookmarks it (bookmarked: false on the
 * same organizer row) — it does NOT delete the row. A company can be
 * bookmarked and actively tracked at once; "remove from saved" shouldn't
 * silently wipe out real interview-prep status the user may have set.
 */
export function SavedList({
  initialEntries,
  isDemo = false,
}: {
  initialEntries: OrganizerEntry[];
  /** A credential-free demo session - see add-demo-mode. The saved page is frozen, so removing the one demo entry (with no way to get it back this session) is disabled rather than allowed. */
  isDemo?: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);

  async function handleRemove(companyKey: string, resolvedName: string) {
    const previous = entries;
    setEntries((es) => es.filter((e) => e.companyKey !== companyKey));

    try {
      const current: { entries?: OrganizerEntrySummary[] } | null = await fetch("/api/organizer").then(
        (res) => (res.ok ? res.json() : null),
      );
      const existing = current?.entries?.find((e) => e.companyKey === companyKey);

      const response = await fetch("/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey,
          resolvedName,
          status: existing?.status ?? "tracking",
          bookmarked: false,
          interviewDate: existing?.interviewDate ?? null,
          confidence: existing?.confidence ?? null,
        }),
      });
      if (!response.ok) setEntries(previous);
    } catch {
      setEntries(previous);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-on-surface-variant">
        Nothing bookmarked yet. Open a company&apos;s brief and tap the star next to
        Copy as text to save it here.
      </p>
    );
  }

  return (
    <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <div
          key={entry.companyKey}
          className="group relative bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-1 hover:shadow-elevation-2 transition-shadow"
        >
          <Link
            href={`/?company=${encodeURIComponent(entry.resolvedName)}`}
            className="block p-5 pr-12"
          >
            <span className="font-bold text-on-surface group-hover:text-primary transition-colors">
              {entry.resolvedName}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => !isDemo && void handleRemove(entry.companyKey, entry.resolvedName)}
            disabled={isDemo}
            aria-label={isDemo ? "Sign in to remove saved companies" : `Remove ${entry.resolvedName} from saved`}
            title={isDemo ? "Sign in to remove saved companies" : "Remove from saved"}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full text-tertiary hover:text-error hover:bg-error-container transition-colors disabled:opacity-40 disabled:hover:text-tertiary disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
          </button>
        </div>
      ))}
    </section>
  );
}
