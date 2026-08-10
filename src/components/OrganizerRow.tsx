"use client";

import type { OrganizerEntry, OrganizerStatus } from "@/lib/storage";
import { STATUS_META, STATUS_ORDER } from "@/lib/organizerStatus";

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated 1d ago";
  return `Updated ${days}d ago`;
}

/**
 * One Kanban card. Fully controlled by the parent board — `entry` is
 * always the current source of truth, so moving between columns after a
 * status change is just the parent re-rendering with a new array, not
 * something this card manages itself. Confidence (1-5, real user input)
 * is the only "match"-style signal shown — nothing here is a fabricated
 * score.
 */
export function OrganizerRow({
  entry,
  onStatusChange,
  onDelete,
}: {
  entry: OrganizerEntry;
  onStatusChange: (companyKey: string, status: OrganizerStatus) => void;
  onDelete: (companyKey: string) => void;
}) {
  const isOffer = entry.status === "offer";

  return (
    <div
      className={`relative rounded-[24px] p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col gap-3 ${
        isOffer
          ? "bg-secondary-fixed/10 border-2 border-secondary-fixed-dim"
          : `bg-surface-container-lowest border-t-4 border-transparent ${STATUS_META[entry.status].accent}`
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Stop tracking ${entry.resolvedName}? This removes it from your organizer.`)) {
            onDelete(entry.companyKey);
          }
        }}
        aria-label={`Stop tracking ${entry.resolvedName}`}
        title="Stop tracking"
        className="absolute top-2 right-2 p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>

      <div className="flex justify-between items-start gap-2 pr-6">
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-on-surface leading-tight truncate">{entry.resolvedName}</span>
          <span className="text-sm text-on-surface-variant">
            {entry.interviewDate ? `Interview: ${entry.interviewDate}` : formatUpdated(entry.updatedAt)}
          </span>
        </div>
        {entry.confidence && (
          <span
            className={`shrink-0 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
              isOffer ? "bg-secondary text-on-secondary" : "bg-primary-fixed text-on-primary-fixed"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">psychology</span>
            {entry.confidence}/5
          </span>
        )}
      </div>

      {entry.confidence && (
        <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isOffer ? "bg-secondary" : "bg-primary-fixed-dim"}`}
            style={{ width: `${(entry.confidence / 5) * 100}%` }}
          />
        </div>
      )}

      <div className="flex justify-end">
        <div className="relative">
          <select
            value={entry.status}
            onChange={(e) => onStatusChange(entry.companyKey, e.target.value as OrganizerStatus)}
            aria-label={`Preparation status for ${entry.resolvedName}`}
            className="appearance-none pl-3 pr-7 py-1 rounded-md bg-surface-container-high text-on-surface text-xs font-bold cursor-pointer"
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined text-[14px] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>
    </div>
  );
}
