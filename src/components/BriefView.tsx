"use client";

import { useState } from "react";
import { briefToPlainText, formatSource } from "@/lib/brief/format";
import { SECTOR_POLICY } from "@/lib/brief/sectors";
import type { Basis, CompanyBrief, SourceRef } from "@/lib/brief/types";

/** Marks whether a statement rests on a source or on the model's analysis. */
function BasisTag({ basis }: { basis: Basis }) {
  return (
    <span className={`basis ${basis}`}>
      {basis === "sourced" ? "sourced" : "analysis"}
    </span>
  );
}

function Cites({
  ids,
  sources,
}: {
  ids: string[];
  sources: SourceRef[];
}) {
  const resolved = ids
    .map((id) => sources.find((s) => s.id === id))
    .filter((s): s is SourceRef => Boolean(s));

  if (resolved.length === 0) return null;

  return (
    <span className="cite">
      {" "}
      {resolved.map((source, index) => (
        <span key={source.id}>
          {index > 0 && ", "}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
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
  return <p className="unavailable">{children}</p>;
}

export function BriefView({ brief }: { brief: CompanyBrief }) {
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
    <article className="brief">
      <header className="brief-head">
        <div>
          <h2>{brief.resolvedName}</h2>
          <p className="cite" style={{ margin: "0.25rem 0 0" }}>
            <span className="sector-chip">
              {brief.classification.confidence === "uncertain"
                ? `Likely ${sectorLabel}`
                : sectorLabel}
            </span>{" "}
            {brief.classification.rationale}
          </p>
        </div>
        <div className="copy-row">
          <button type="button" className="secondary" onClick={copyBrief}>
            {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
      </header>

      <section className="card">
        <h3>Overview</h3>
        <p>
          {brief.overview.body} <BasisTag basis={brief.overview.basis} />
          <Cites ids={brief.overview.sourceIds} sources={brief.sources} />
        </p>
      </section>

      <section className="card">
        <h3>Recent news</h3>
        {brief.news.unavailable ? (
          <Unavailable>{brief.news.unavailable}</Unavailable>
        ) : (
          brief.news.items.map((item, index) => (
            <div className="news-item" key={`${item.title}-${index}`}>
              <h4>{item.title}</h4>
              {item.date && <p className="date">{item.date}</p>}
              <p>
                {item.summary}
                <Cites ids={item.sourceIds} sources={brief.sources} />
              </p>
              <p className="why">Why it matters: {item.whyItMatters}</p>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h3>{brief.deepDive.heading}</h3>
        {brief.deepDive.usedFallback && (
          <p className="why">
            The sector could not be identified confidently, so this is a general
            business deep dive rather than a sector-specific one.
          </p>
        )}
        {brief.deepDive.unavailable && (
          <Unavailable>{brief.deepDive.unavailable}</Unavailable>
        )}
        {brief.deepDive.topics.map((topic, index) => (
          <div className="topic" key={`${topic.heading}-${index}`}>
            <h4>{topic.heading}</h4>
            <p>
              {topic.body} <BasisTag basis={topic.basis} />
              <Cites ids={topic.sourceIds} sources={brief.sources} />
            </p>
          </div>
        ))}
      </section>

      {/* Omitted entirely when 4P does not apply to this sector — not rendered
          empty, and not filled with generic industry content. */}
      {brief.fourP && (
        <section className="card">
          <h3>4P analysis</h3>
          {brief.fourP.entries.map((entry) => (
            <div className="fourp-entry" key={entry.dimension}>
              <h4>{entry.dimension}</h4>
              <p>
                {entry.body} <BasisTag basis={entry.basis} />
                <Cites ids={entry.sourceIds} sources={brief.sources} />
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h3>Talking points</h3>
        <ol className="points">
          {brief.talkingPoints.map((point, index) => (
            <li key={index}>
              {point.point} <BasisTag basis={point.basis} />
              <Cites ids={point.sourceIds} sources={brief.sources} />
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h3>Questions to ask the interviewer</h3>
        <ol className="questions">
          {brief.interviewerQuestions.map((item, index) => (
            <li key={index}>
              {item.question}
              <br />
              <span className="rationale">Why: {item.rationale}</span>
            </li>
          ))}
        </ol>
      </section>

      {brief.unavailableNotes.length > 0 && (
        <section className="card">
          <h3>Could not be established</h3>
          <ul>
            {brief.unavailableNotes.map((note, index) => (
              <li key={index} className="why">
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Sources</h3>
        <ul className="sources">
          {brief.sources.map((source) => (
            <li key={source.id}>
              <span className="sid">[{source.id}]</span>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {formatSource(source)}
                </a>
              ) : (
                formatSource(source)
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
