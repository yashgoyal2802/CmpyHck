import { isSector, type Sector } from "@/lib/brief/sectors";
import type { Classification, SourceRef } from "@/lib/brief/types";

/**
 * Shape of the grounding metadata we consume. Declared structurally rather than
 * imported so a provider-SDK type change cannot silently break the mapping —
 * and so the fallback provider can synthesise the same shape.
 */
export interface GroundingChunkLike {
  web?: {
    uri?: string | null;
    title?: string | null;
    domain?: string | null;
  } | null;
}

export interface GroundingMetadataLike {
  groundingChunks?: GroundingChunkLike[] | null;
}

/**
 * Hosts that proxy the real source behind a redirect. For these the `title`
 * field carries the publisher domain, so it — not the URL hostname — is what
 * identifies the source to a reader.
 */
const GROUNDING_REDIRECT_HOSTS = new Set(["vertexaisearch.cloud.google.com"]);

/**
 * Map provider grounding metadata onto brief source references.
 *
 * Ids are positional (`s1`, `s2`, ...) and stable within one brief, which is
 * what the structuring stage cites. Chunks without a usable title or URI are
 * dropped rather than rendered as an empty citation.
 */
export function mapGroundingToSources(
  metadata: GroundingMetadataLike | null | undefined,
): SourceRef[] {
  const chunks = metadata?.groundingChunks ?? [];
  const sources: SourceRef[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web) continue;

    const url = web.uri?.trim() || undefined;
    const rawTitle = web.title?.trim() || undefined;

    // A chunk with neither a title nor a URL cannot be shown as a citation and
    // would render as an empty source line, so drop it.
    if (!rawTitle && !url) continue;

    // Gemini hands back a redirect URI on its own grounding host and puts the
    // real publisher domain in `title`. Taking the hostname here would label
    // every single source "vertexaisearch.cloud.google.com", which tells the
    // reader nothing and makes source-checking impossible.
    const urlHost = domainFromUrl(url);
    const viaRedirect = urlHost ? GROUNDING_REDIRECT_HOSTS.has(urlHost) : false;

    const sourceLabel =
      web.domain?.trim() ||
      (viaRedirect ? rawTitle : urlHost) ||
      rawTitle ||
      urlHost ||
      "Unknown source";
    const title = rawTitle ?? sourceLabel;

    // De-duplicate: grounding often returns the same page for several supports.
    const key = url ?? `${title}|${sourceLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sources.push({
      id: `s${sources.length + 1}`,
      title,
      url,
      sourceLabel,
    });
  }

  return sources;
}

export function domainFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export interface ParsedResearch {
  resolvedName?: string;
  ambiguousCandidates?: string[];
  noResults: boolean;
  classification: Classification;
  findings: string;
}

/**
 * Parse the labelled research report from stage one.
 *
 * Tolerant by design: a missing or malformed label degrades to a safe default
 * (uncertain classification, which routes to the general deep dive) rather than
 * failing the request. The findings prose is what stage two actually consumes.
 */
export function parseResearchText(text: string): ParsedResearch {
  const resolvedName = readLabel(text, "RESOLVED_NAME");

  const ambiguousRaw = readLabel(text, "AMBIGUOUS");
  const ambiguousCandidates =
    ambiguousRaw && !isNegative(ambiguousRaw)
      ? ambiguousRaw
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      : undefined;

  const noResults = isAffirmative(readLabel(text, "NO_RESULTS"));

  const sectorRaw = readLabel(text, "SECTOR")?.toLowerCase().trim();
  const sector: Sector = isSector(sectorRaw) ? sectorRaw : "other";

  const confidenceRaw = readLabel(text, "CONFIDENCE")?.toLowerCase().trim();
  // Anything other than an explicit "likely" is treated as uncertain, so an
  // unparseable confidence errs toward the general deep dive.
  const confidence: Classification["confidence"] =
    confidenceRaw === "likely" && isSector(sectorRaw) ? "likely" : "uncertain";

  const marketingRelevant = isAffirmative(readLabel(text, "MARKETING_RELEVANT"));

  const rationale =
    readLabel(text, "CLASSIFICATION_RATIONALE") ??
    "Classification rationale was not stated by the research stage.";

  return {
    resolvedName,
    ambiguousCandidates:
      ambiguousCandidates && ambiguousCandidates.length > 1
        ? ambiguousCandidates
        : undefined,
    noResults,
    classification: { sector, confidence, rationale, marketingRelevant },
    findings: text.trim(),
  };
}

/**
 * Read a `LABEL:` value.
 *
 * Line-oriented rather than a multi-line regex: labels always occupy one line,
 * and scanning avoids the catastrophic backtracking a lookahead-based pattern
 * invites on long research reports.
 */
function readLabel(text: string, label: string): string | undefined {
  const prefix = `${label}:`;
  for (const line of text.split("\n")) {
    const trimmed = line.trim().replace(/^\*+\s*/, "");
    if (trimmed.toUpperCase().startsWith(prefix)) {
      return cleanValue(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

function cleanValue(value: string): string | undefined {
  // Strip markdown emphasis the model sometimes wraps labels in. Index-based
  // rather than a regex, which backtracks on long runs of asterisks.
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "*") start += 1;
  while (end > start && value[end - 1] === "*") end -= 1;

  const cleaned = value.slice(start, end).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface ParsedNewsResearch {
  noResults: boolean;
  findings: string;
}

/** Parse the labelled response from `buildNewsResearchPrompt` — just NO_RESULTS and prose. */
export function parseNewsResearchText(text: string): ParsedNewsResearch {
  return {
    noResults: isAffirmative(readLabel(text, "NO_RESULTS")),
    findings: text.trim(),
  };
}

function isAffirmative(value: string | undefined): boolean {
  if (!value) return false;
  return /^(yes|true)\b/i.test(value.trim());
}

function isNegative(value: string | undefined): boolean {
  if (!value) return true;
  return /^(no|none|n\/a|false)\b/i.test(value.trim());
}
