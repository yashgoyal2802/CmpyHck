import { SECTOR_POLICY } from "./sectors";
import type { CompanyBrief, SourceRef } from "./types";

/**
 * Render a brief as plain text for copying into notes.
 *
 * Source references are carried through rather than stripped: the whole value
 * of the brief is that the student can tell a sourced fact from analysis, and
 * a copy that drops citations quietly destroys that. Citation markers stay
 * inline and the full source list is appended.
 */
export function briefToPlainText(brief: CompanyBrief): string {
  const lines: string[] = [];
  const cite = (ids: string[]) => (ids.length > 0 ? ` [${ids.join(", ")}]` : "");
  const tag = (basis: string) => (basis === "inferred" ? " (analysis)" : "");

  lines.push(brief.resolvedName.toUpperCase());
  if (brief.requestedName !== brief.resolvedName) {
    lines.push(`Searched as: ${brief.requestedName}`);
  }
  lines.push(
    `Sector: ${SECTOR_POLICY[brief.classification.sector].label}` +
      (brief.classification.confidence === "uncertain" ? " (likely)" : ""),
  );
  lines.push(`Generated: ${brief.generatedAt}`);
  lines.push("");

  lines.push("OVERVIEW");
  lines.push(brief.overview.body + tag(brief.overview.basis) + cite(brief.overview.sourceIds));
  lines.push("");

  lines.push("RECENT NEWS");
  if (brief.news.unavailable) {
    lines.push(brief.news.unavailable);
  } else {
    for (const item of brief.news.items) {
      lines.push(`- ${item.title}${item.date ? ` (${item.date})` : ""}`);
      lines.push(`  ${item.summary}${cite(item.sourceIds)}`);
      lines.push(`  Why it matters: ${item.whyItMatters}`);
    }
  }
  lines.push("");

  lines.push(brief.deepDive.heading.toUpperCase());
  if (brief.deepDive.unavailable) {
    lines.push(brief.deepDive.unavailable);
  }
  for (const topic of brief.deepDive.topics) {
    lines.push(`- ${topic.heading}`);
    lines.push(`  ${topic.body}${tag(topic.basis)}${cite(topic.sourceIds)}`);
  }
  lines.push("");

  if (brief.fourP) {
    lines.push("4P ANALYSIS");
    for (const entry of brief.fourP.entries) {
      lines.push(`- ${entry.dimension}: ${entry.body}${tag(entry.basis)}${cite(entry.sourceIds)}`);
    }
    lines.push("");
  }

  lines.push("TALKING POINTS");
  brief.talkingPoints.forEach((point, index) => {
    lines.push(`${index + 1}. ${point.point}${tag(point.basis)}${cite(point.sourceIds)}`);
  });
  lines.push("");

  lines.push("QUESTIONS TO ASK");
  brief.interviewerQuestions.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`);
    lines.push(`   Why: ${item.rationale}`);
  });
  lines.push("");

  if (brief.unavailableNotes.length > 0) {
    lines.push("COULD NOT BE ESTABLISHED");
    for (const note of brief.unavailableNotes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push("SOURCES");
  for (const source of brief.sources) {
    lines.push(`[${source.id}] ${formatSource(source)}`);
  }

  return lines.join("\n");
}

export function formatSource(source: SourceRef): string {
  const parts: string[] = [source.title];
  // Grounding often gives only the publisher domain, landing in both fields;
  // printing it twice reads as a bug.
  if (source.sourceLabel !== source.title) parts.push(source.sourceLabel);
  if (source.date) parts.push(source.date);
  if (source.url) parts.push(source.url);
  return parts.join(" — ");
}
