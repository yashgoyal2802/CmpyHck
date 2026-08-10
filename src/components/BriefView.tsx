"use client";

import { useEffect, useState } from "react";
import { briefToPlainText, formatSource } from "@/lib/brief/format";
import { SECTOR_POLICY } from "@/lib/brief/sectors";
import type { Basis, CompanyBrief, Framework, SourceRef } from "@/lib/brief/types";
import { OrganizerPanel } from "./OrganizerPanel";

/** Marks whether a statement rests on a source or on the model's analysis. */
function BasisTag({ basis }: { basis: Basis }) {
  const sourced = basis === "sourced";
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full align-middle ${
        sourced
          ? "bg-secondary-container text-on-secondary-container"
          : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      {sourced ? "sourced" : "analysis"}
    </span>
  );
}

function Cites({ ids, sources }: { ids: string[]; sources: SourceRef[] }) {
  const resolved = ids
    .map((id) => sources.find((s) => s.id === id))
    .filter((s): s is SourceRef => Boolean(s));

  if (resolved.length === 0) return null;

  return (
    <span className="text-sm text-on-surface-variant ml-1">
      {resolved.map((source, index) => (
        <span key={source.id}>
          {index > 0 && ", "}
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-on-surface-variant underline decoration-dotted hover:text-primary hover:decoration-solid"
            >
              [{source.id}]
            </a>
          ) : (
            <span>[{source.id}]</span>
          )}
        </span>
      ))}
    </span>
  );
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-3 rounded-xl border border-dashed border-outline-variant text-on-surface-variant text-sm">
      {children}
    </p>
  );
}

// Every card arrives in the same second wave, right behind the header and
// lead answer — see the motion thesis on BriefView. A shared, fixed delay
// here (rather than per-card staggering) keeps an 8-section report from
// reading as an indefinitely staggered list.
const CARD_ENTRANCE_DELAY = "160ms";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-1 hover:shadow-elevation-2 transition-shadow p-6 flex flex-col gap-3 animate-entrance"
      style={{ animationDelay: CARD_ENTRANCE_DELAY }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function formatCachedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Rolls up every claim-bearing block in the brief into one sourced-vs-inferred
 * count. Presentation only — nothing here is generated, it is a tally over
 * fields the brief already carries.
 */
function tallyClaims(brief: CompanyBrief): { sourced: number; total: number } {
  const claims: { basis: Basis }[] = [
    brief.overview,
    ...brief.deepDive.topics,
    ...brief.framework.entries,
    ...brief.talkingPoints,
  ];
  return {
    sourced: claims.filter((c) => c.basis === "sourced").length,
    total: claims.length,
  };
}

/**
 * The at-a-glance read: how much of this brief is evidence versus the
 * model's own reasoning, before the reader commits to the full prose below.
 * One continuous bar rather than a grid of stat tiles — the proportion IS
 * the content, not a number decorating a card.
 */
function BriefVitals({ brief }: { brief: CompanyBrief }) {
  const { sourced, total } = tallyClaims(brief);
  const sourcedPct = total > 0 ? Math.round((sourced / total) * 100) : 0;

  return (
    <div
      className="rounded-[1.5rem] bg-surface-container-lowest shadow-elevation-1 p-5 flex flex-col gap-3 animate-entrance"
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-primary tabular-nums">{sourcedPct}%</span>
          <span className="text-sm text-on-surface-variant">
            of this brief ({sourced} of {total} claims) traces to a source; the rest is labelled analysis.
          </span>
        </div>
        <dl className="flex items-center gap-4 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-on-surface-variant">Sources</dt>
            <dd className="font-bold text-on-surface tabular-nums">{brief.sources.length}</dd>
          </div>
          <div className="w-px h-4 bg-outline-variant" aria-hidden="true" />
          <div className="flex items-baseline gap-1.5">
            <dt className="text-on-surface-variant">Talking points</dt>
            <dd className="font-bold text-on-surface tabular-nums">{brief.talkingPoints.length}</dd>
          </div>
          <div className="w-px h-4 bg-outline-variant" aria-hidden="true" />
          <div className="flex items-baseline gap-1.5">
            <dt className="text-on-surface-variant">Interviewer Qs</dt>
            <dd className="font-bold text-on-surface tabular-nums">{brief.interviewerQuestions.length}</dd>
          </div>
        </dl>
      </div>
      <div
        className="h-2 rounded-full bg-surface-container-high overflow-hidden flex"
        role="img"
        aria-label={`${sourced} of ${total} claims sourced`}
      >
        <div className="bg-secondary h-full transition-[width]" style={{ width: `${sourcedPct}%` }} />
      </div>
    </div>
  );
}

/**
 * The 4P section drawn as an actual quadrant — a cross divider forming four
 * cells — rather than four interchangeable cards. Product/Price sit over
 * Place/Promotion, mirroring the classic marketing-mix layout.
 */
function FourPQuadrant({ framework, sources }: { framework: Extract<Framework, { kind: "four_p" }>; sources: SourceRef[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-outline-variant/40 rounded-xl overflow-hidden border-2 border-outline-variant/40">
      {framework.entries.map((entry) => (
        <div key={entry.dimension} className="p-4 flex flex-col gap-1.5 bg-surface-container-lowest">
          <h4 className="font-bold text-primary text-sm uppercase tracking-wide">{entry.dimension}</h4>
          <p className="text-on-surface">
            {entry.body} <BasisTag basis={entry.basis} />
            <Cites ids={entry.sourceIds} sources={sources} />
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Porter's Five Forces drawn the way the framework itself is always drawn:
 * Competitive Rivalry as the pressured center, the other four forces
 * arranged around it. On narrow screens the diagram collapses to a plain
 * stack — the cross layout only earns its keep with room to breathe.
 */
function FiveForcesDiagram({ framework, sources }: { framework: Extract<Framework, { kind: "five_forces" }>; sources: SourceRef[] }) {
  const byDimension = new Map(framework.entries.map((e) => [e.dimension, e]));
  const rivalry = byDimension.get("Competitive Rivalry");
  const satellites = framework.entries.filter((e) => e.dimension !== "Competitive Rivalry");
  const positions: Record<string, string> = {
    "Supplier Power": "left",
    "Buyer Power": "right",
    "Threat of Substitutes": "top",
    "Threat of New Entrants": "bottom",
  };

  const ForceCell = ({ entry }: { entry: (typeof framework.entries)[number] }) => (
    <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1.5 h-full">
      <h4 className="font-bold text-on-surface text-sm">{entry.dimension}</h4>
      <p className="text-on-surface text-sm">
        {entry.body} <BasisTag basis={entry.basis} />
        <Cites ids={entry.sourceIds} sources={sources} />
      </p>
    </div>
  );

  return (
    <div
      className="hidden md:grid gap-3"
      style={{
        gridTemplateAreas: `". top ." "left center right" ". bottom ."`,
        gridTemplateColumns: "1fr 1.3fr 1fr",
      }}
    >
      {satellites.map((entry) => (
        <div key={entry.dimension} style={{ gridArea: positions[entry.dimension] }}>
          <ForceCell entry={entry} />
        </div>
      ))}
      {rivalry && (
        <div style={{ gridArea: "center" }} className="p-4 rounded-xl bg-primary text-on-primary flex flex-col gap-1.5 shadow-elevation-1">
          <h4 className="font-bold text-sm uppercase tracking-wide">{rivalry.dimension}</h4>
          <p className="text-sm">
            {rivalry.body}
            <Cites ids={rivalry.sourceIds} sources={sources} />
          </p>
        </div>
      )}
      {/* Mobile fallback of the same content, plain stack. */}
    </div>
  );
}

function FiveForcesStack({ framework, sources }: { framework: Extract<Framework, { kind: "five_forces" }>; sources: SourceRef[] }) {
  return (
    <div className="grid md:hidden gap-3">
      {framework.entries.map((entry) => (
        <div key={entry.dimension} className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1.5">
          <h4 className="font-bold text-on-surface text-sm">{entry.dimension}</h4>
          <p className="text-on-surface text-sm">
            {entry.body} <BasisTag basis={entry.basis} />
            <Cites ids={entry.sourceIds} sources={sources} />
          </p>
        </div>
      ))}
    </div>
  );
}

interface OrganizerEntrySummary {
  companyKey: string;
  status?: string;
  bookmarked: boolean;
  interviewDate: string | null;
  confidence: number | null;
}

/** Independent of the OrganizerPanel tracker form below — a one-click reference marker, not a prep-status change. */
function BookmarkButton({ companyKey, resolvedName }: { companyKey: string; resolvedName: string }) {
  const [bookmarked, setBookmarked] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizer")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entries?: OrganizerEntrySummary[] } | null) => {
        if (cancelled) return;
        const existing = data?.entries?.find((e) => e.companyKey === companyKey);
        setBookmarked(existing?.bookmarked ?? false);
      })
      .catch(() => {
        if (!cancelled) setBookmarked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  async function toggle() {
    if (bookmarked === null || pending) return;
    setPending(true);
    const next = !bookmarked;
    try {
      const current: { entries?: OrganizerEntrySummary[] } | null = await fetch("/api/organizer").then((res) =>
        res.ok ? res.json() : null,
      );
      const existing = current?.entries?.find((e) => e.companyKey === companyKey);

      const response = await fetch("/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey,
          resolvedName,
          status: existing?.status ?? "tracking",
          bookmarked: next,
          interviewDate: existing?.interviewDate ?? null,
          confidence: existing?.confidence ?? null,
        }),
      });
      if (response.ok) setBookmarked(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={bookmarked === null || pending}
      aria-pressed={bookmarked ?? false}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this company"}
      title={bookmarked ? "Remove bookmark" : "Bookmark this company"}
      className={`grid place-items-center w-10 h-10 rounded-full active:scale-[0.94] transition-[background-color,transform,color] disabled:opacity-50 ${
        bookmarked
          ? "bg-tertiary-fixed text-on-tertiary-fixed"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]" style={bookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
        star
      </span>
    </button>
  );
}

export function BriefView({
  brief,
  onForceRefresh,
}: {
  brief: CompanyBrief;
  onForceRefresh?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const sectorLabel = SECTOR_POLICY[brief.classification.sector].label;

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefToPlainText(brief));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="w-full min-w-0 flex flex-col gap-6 mt-12">
      <header
        className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-entrance"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
            {brief.resolvedName}
          </h2>
          <p className="text-sm text-on-surface-variant flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold uppercase tracking-wide">
              {brief.classification.confidence === "uncertain"
                ? `Likely ${sectorLabel}`
                : sectorLabel}
            </span>
            {brief.classification.rationale}
          </p>
          {brief.cache && (
            <p className="text-sm text-on-surface-variant">
              {brief.cache.fromCache
                ? `Facts reused from cache (last fully researched ${formatCachedAt(brief.cache.cachedAt)}). News is always fresh.`
                : "Freshly researched."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BookmarkButton companyKey={brief.companyKey} resolvedName={brief.resolvedName} />
          {onForceRefresh && (
            <button
              type="button"
              onClick={onForceRefresh}
              className="px-4 py-2 rounded-full bg-surface-container text-on-surface text-sm font-semibold hover:bg-surface-container-high active:scale-[0.97] transition-[background-color,transform]"
            >
              Force refresh
            </button>
          )}
          <button
            type="button"
            onClick={copyBrief}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold active:scale-[0.97] transition-[background-color,transform] ${
              copied
                ? "bg-secondary-container text-on-secondary-container animate-pulse-once"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
      </header>

      <BriefVitals brief={brief} />

      {/* The one thing every reader needs first — lead prose, not another
          card, so it reads as the answer rather than one section among equals. */}
      <p
        className="text-lg text-on-surface leading-relaxed max-w-[75ch] animate-entrance"
        style={{ animationDelay: "80ms" }}
      >
        {brief.overview.body} <BasisTag basis={brief.overview.basis} />
        <Cites ids={brief.overview.sourceIds} sources={brief.sources} />
      </p>

      {brief.cache?.fromCache && (
        <Card title="What's new since you last checked">
          {brief.cache.newSinceLastSeen && brief.cache.newSinceLastSeen.length > 0 ? (
            <ul className="flex flex-col gap-1 list-disc pl-5 animate-pulse-once rounded-lg -m-1 p-1">
              {brief.cache.newSinceLastSeen.map((item, index) => (
                <li key={`${item.title}-${index}`} className="text-on-surface">
                  {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">Nothing new since your last search.</p>
          )}
        </Card>
      )}

      <Card title="Recent news">
        {brief.news.unavailable ? (
          <Unavailable>{brief.news.unavailable}</Unavailable>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant/30">
            {brief.news.items.map((item, index) => {
              // The title links straight to the first citable source, so
              // clicking through to the actual article doesn't depend on
              // spotting the small [n1]-style citation bracket.
              const primarySource = item.sourceIds
                .map((id) => brief.sources.find((s) => s.id === id))
                .find((s): s is SourceRef => Boolean(s?.url));

              return (
                <div className="py-3 first:pt-0 last:pb-0" key={`${item.title}-${index}`}>
                  {primarySource ? (
                    <a
                      href={primarySource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-on-surface hover:text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {item.title}
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  ) : (
                    <h4 className="font-bold text-on-surface">{item.title}</h4>
                  )}
                  {item.date && <p className="text-xs text-on-surface-variant mt-0.5">{item.date}</p>}
                  <p className="text-on-surface mt-1 max-w-[75ch]">
                    {item.summary}
                    <Cites ids={item.sourceIds} sources={brief.sources} />
                  </p>
                  <p className="text-on-surface-variant text-sm mt-1 max-w-[75ch]">
                    Why it matters: {item.whyItMatters}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={brief.deepDive.heading}>
        {brief.deepDive.usedFallback && (
          <p className="text-on-surface-variant text-sm">
            The sector could not be identified confidently, so this is a general
            business deep dive rather than a sector-specific one.
          </p>
        )}
        {brief.deepDive.unavailable && <Unavailable>{brief.deepDive.unavailable}</Unavailable>}
        <div className="flex flex-col divide-y divide-outline-variant/30">
          {brief.deepDive.topics.map((topic, index) => (
            <div className="py-3 first:pt-0 last:pb-0" key={`${topic.heading}-${index}`}>
              <h4 className="font-bold text-on-surface">{topic.heading}</h4>
              <p className="text-on-surface mt-1 max-w-[75ch]">
                {topic.body} <BasisTag basis={topic.basis} />
                <Cites ids={topic.sourceIds} sources={brief.sources} />
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={brief.framework.kind === "four_p" ? "4P analysis" : "Porter's Five Forces"}>
        {brief.framework.kind === "four_p" ? (
          <FourPQuadrant framework={brief.framework} sources={brief.sources} />
        ) : (
          <>
            <FiveForcesDiagram framework={brief.framework} sources={brief.sources} />
            <FiveForcesStack framework={brief.framework} sources={brief.sources} />
          </>
        )}
      </Card>

      <Card title="Talking points">
        <ol className="flex flex-col gap-3">
          {brief.talkingPoints.map((point, index) => (
            <li key={index} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold grid place-items-center mt-0.5">
                {index + 1}
              </span>
              <span className="text-on-surface max-w-[75ch]">
                {point.point} <BasisTag basis={point.basis} />
                <Cites ids={point.sourceIds} sources={brief.sources} />
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Questions to ask the interviewer">
        <ol className="flex flex-col gap-3">
          {brief.interviewerQuestions.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold grid place-items-center mt-0.5">
                {index + 1}
              </span>
              <span className="text-on-surface">
                {item.question}
                <br />
                <span className="text-on-surface-variant text-sm">Why: {item.rationale}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {brief.unavailableNotes.length > 0 && (
        <Card title="Could not be established">
          <ul className="flex flex-col gap-1 list-disc pl-5">
            {brief.unavailableNotes.map((note, index) => (
              <li key={index} className="text-on-surface-variant text-sm">
                {note}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <OrganizerPanel companyKey={brief.companyKey} resolvedName={brief.resolvedName} />

      <Card title="Sources">
        <ul className="flex flex-col divide-y divide-outline-variant/30 text-sm">
          {brief.sources.map((source) => (
            <li key={source.id} className="py-2 first:pt-0 last:pb-0">
              <span className="text-on-surface-variant tabular-nums mr-2">[{source.id}]</span>
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-on-surface hover:text-primary break-all"
                >
                  {formatSource(source)}
                </a>
              ) : (
                <span className="text-on-surface break-words">{formatSource(source)}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </article>
  );
}
