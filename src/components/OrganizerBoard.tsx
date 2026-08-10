"use client";

import { useState } from "react";
import { OrganizerRow } from "@/components/OrganizerRow";
import { STATUS_META, STATUS_ORDER } from "@/lib/organizerStatus";
import type { OrganizerEntry, OrganizerStatus } from "@/lib/storage";

/**
 * Owns the live entry list client-side. The board (columns + stats) is
 * derived from this state on every render, so a status change or a
 * delete regroups columns and recomputes stats immediately — no reload,
 * no waiting on the server round-trip to see the effect. The API call
 * still happens, but only to persist; the UI never waits on it.
 */
export function OrganizerBoard({ initialEntries }: { initialEntries: OrganizerEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);

  async function handleStatusChange(companyKey: string, status: OrganizerStatus) {
    const previous = entries;
    const entry = entries.find((e) => e.companyKey === companyKey);
    if (!entry) return;

    setEntries((es) => es.map((e) => (e.companyKey === companyKey ? { ...e, status } : e)));

    try {
      const response = await fetch("/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey: entry.companyKey,
          resolvedName: entry.resolvedName,
          status,
          bookmarked: entry.bookmarked,
          interviewDate: entry.interviewDate,
          confidence: entry.confidence,
        }),
      });
      if (!response.ok) setEntries(previous);
    } catch {
      setEntries(previous);
    }
  }

  async function handleDelete(companyKey: string) {
    const previous = entries;
    setEntries((es) => es.filter((e) => e.companyKey !== companyKey));

    try {
      const response = await fetch(`/api/organizer?companyKey=${encodeURIComponent(companyKey)}`, {
        method: "DELETE",
      });
      if (!response.ok) setEntries(previous);
    } catch {
      setEntries(previous);
    }
  }

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    entries: entries
      .filter((e) => e.status === status)
      // Soonest interview first within a column, undated entries after every dated one.
      .sort((a, b) => {
        if (a.interviewDate && b.interviewDate) return a.interviewDate.localeCompare(b.interviewDate);
        if (a.interviewDate) return -1;
        if (b.interviewDate) return 1;
        return a.resolvedName.localeCompare(b.resolvedName);
      }),
  }));

  if (entries.length === 0) {
    return (
      <p className="text-on-surface-variant">
        Nothing tracked yet. Search a company and use the tracker on its brief to add it here.
      </p>
    );
  }

  return (
    <>
      <StatsRow entries={entries} />
      {/*
        `overflow-x-auto` here forces the browser to treat `overflow-y` as
        `auto` too (a CSS spec rule: one axis non-visible implicitly makes
        the other `auto`, not truly `visible`), so anything a card does
        that pokes outside its own box — the hover lift's -translate-y,
        the hover shadow's blur — gets silently clipped by this container's
        edge. Generous top/bottom padding keeps that clip boundary clear of
        anything a card actually does; `pr-4` gives the last column
        breathing room instead of sitting flush against the scroll edge.
      */}
      <section className="flex gap-6 overflow-x-auto pt-6 pb-6 pr-4 snap-x snap-mandatory">
        {byStatus.map(({ status, entries: columnEntries }) => (
          <div
            key={status}
            className="flex-none w-[280px] md:w-[calc(33.333%-16px)] lg:w-[calc(16.666%-20px)] min-w-[240px] flex flex-col gap-3 snap-start"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className={`font-bold flex items-center gap-2 ${STATUS_META[status].text}`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_META[status].dot}`} />
                <span className="text-sm">{STATUS_META[status].label}</span>
              </h2>
              <span className="bg-surface-container-high text-on-surface px-2 py-0.5 rounded-md text-xs font-bold shrink-0">
                {columnEntries.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {columnEntries.map((entry) => (
                <OrganizerRow
                  key={entry.companyKey}
                  entry={entry}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

const CORNER_BLOB: Record<string, string> = {
  tracked: "bg-primary-fixed",
  progress: "bg-tertiary-fixed",
  offers: "bg-secondary-fixed",
};

function StatsRow({ entries }: { entries: OrganizerEntry[] }) {
  const tracked = entries.length;
  const inProgress = entries.filter((e) =>
    ["prepping", "interview_scheduled", "interviewed"].includes(e.status),
  ).length;
  const offers = entries.filter((e) => e.status === "offer").length;

  const rated = entries.filter((e) => e.confidence !== null);
  const avgConfidence =
    rated.length > 0 ? rated.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / rated.length : null;
  const avgPct = avgConfidence !== null ? Math.round((avgConfidence / 5) * 100) : null;
  // SVG circumference for r=15.9155 (the classic "100 = full circle" trick).
  const dashArray = avgPct !== null ? `${avgPct}, 100` : "0, 100";

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      <StatTile label="Tracked" value={tracked} blob={CORNER_BLOB.tracked} valueClass="text-primary" />
      <StatTile label="In progress" value={inProgress} blob={CORNER_BLOB.progress} valueClass="text-tertiary" />
      <StatTile label="Offers" value={offers} blob={CORNER_BLOB.offers} valueClass="text-secondary" />
      <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow justify-between">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Avg. confidence
        </span>
        {avgPct !== null ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-high"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="text-secondary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={dashArray}
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
              <span className="absolute text-xs font-bold text-primary">{avgPct}%</span>
            </div>
            <span className="text-sm text-on-surface-variant leading-tight">
              Across {rated.length} rated {rated.length === 1 ? "company" : "companies"}.
            </span>
          </div>
        ) : (
          <span className="text-sm text-on-surface-variant leading-tight self-end">
            Set a confidence rating to see this.
          </span>
        )}
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  blob,
  valueClass,
}: {
  label: string;
  value: number;
  blob: string;
  valueClass: string;
}) {
  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow relative overflow-hidden group">
      <div
        className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform ${blob}`}
        aria-hidden="true"
      />
      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider relative z-10">
        {label}
      </span>
      <span className={`text-5xl font-extrabold relative z-10 tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
