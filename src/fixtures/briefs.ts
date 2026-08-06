import type { BriefDraft } from "@/lib/providers/draft";
import type { ResearchResult } from "@/lib/providers/types";
import type { Sector } from "@/lib/brief/sectors";
import type { SourceRef } from "@/lib/brief/types";

/**
 * Fixture briefs used by the fake provider and the test suite.
 *
 * These stand in for live research so the assembler, section policy, and
 * renderer can be tested deterministically. Search-inside-generation means
 * filtering behaviour itself is not unit-testable; these fixtures test
 * everything downstream of it.
 */
export interface BriefFixture {
  research: ResearchResult;
  draft: BriefDraft;
}

function sources(...entries: Array<Partial<SourceRef> & { title: string }>): SourceRef[] {
  return entries.map((entry, index) => ({
    id: `s${index + 1}`,
    title: entry.title,
    url: entry.url ?? `https://example.com/${index + 1}`,
    sourceLabel: entry.sourceLabel ?? "example.com",
    date: entry.date,
  }));
}

interface FixtureOptions {
  name: string;
  sector: Sector;
  marketingRelevant?: boolean;
  confidence?: "likely" | "uncertain";
  includeFourP?: boolean;
  newsCount?: number;
  newsUnavailable?: string;
  deepDiveUnavailable?: string;
}

/** Build a schema-valid fixture, so tests assert on behaviour not on shape. */
export function makeFixture(options: FixtureOptions): BriefFixture {
  const {
    name,
    sector,
    marketingRelevant = false,
    confidence = "likely",
    includeFourP = false,
    newsCount = 4,
    newsUnavailable,
    deepDiveUnavailable,
  } = options;

  const sourceList = sources(
    { title: `${name} announces strategic expansion`, sourceLabel: "economictimes.com", date: "2026-06-14" },
    { title: `${name} quarterly results`, sourceLabel: "moneycontrol.com", date: "2026-05-02" },
    { title: `${name} company profile`, sourceLabel: "business-standard.com" },
  );

  const newsItems = Array.from({ length: newsUnavailable ? 0 : newsCount }, (_, i) => ({
    title: `${name} development ${i + 1}`,
    summary: `A specific, dated development at ${name} relevant to placement preparation.`,
    whyItMatters: `An interviewer would expect the candidate to connect this to ${name}'s direction.`,
    date: "2026-06-14",
    sourceIds: [sourceList[i % sourceList.length].id],
  }));

  const draft: BriefDraft = {
    resolvedName: name,
    overview: {
      body: `${name} operates in the ${sector} space and makes money through its core business lines.`,
      basis: "sourced",
      sourceIds: [sourceList[2].id],
    },
    classification: {
      sector,
      confidence,
      rationale: `Interviews at ${name} centre on themes characteristic of the ${sector} bucket.`,
      marketingRelevant,
    },
    news: newsUnavailable
      ? { items: [], unavailable: newsUnavailable }
      : { items: newsItems },
    deepDive: deepDiveUnavailable
      ? { heading: "Deep dive", topics: [], unavailable: deepDiveUnavailable }
      : {
          heading: "Deep dive",
          topics: [
            {
              heading: "Strategic direction",
              body: `Evidence-backed detail about ${name}'s direction.`,
              basis: "sourced",
              sourceIds: [sourceList[0].id],
            },
            {
              heading: "Competitive position",
              body: `Analysis of where ${name} sits against peers.`,
              basis: "inferred",
              sourceIds: [],
            },
          ],
        },
    fourP: includeFourP
      ? {
          entries: [
            { dimension: "Product", body: `${name}'s portfolio and range.`, basis: "sourced", sourceIds: [sourceList[2].id] },
            { dimension: "Price", body: `${name}'s pricing posture.`, basis: "inferred", sourceIds: [] },
            { dimension: "Place", body: `${name}'s distribution and channels.`, basis: "sourced", sourceIds: [sourceList[0].id] },
            { dimension: "Promotion", body: `${name}'s promotional activity.`, basis: "inferred", sourceIds: [] },
          ],
        }
      : null,
    talkingPoints: Array.from({ length: 5 }, (_, i) => ({
      point: `Talking point ${i + 1} connecting ${name}'s research to an interview answer.`,
      basis: i % 2 === 0 ? ("sourced" as const) : ("inferred" as const),
      sourceIds: i % 2 === 0 ? [sourceList[0].id] : [],
    })),
    interviewerQuestions: Array.from({ length: 3 }, (_, i) => ({
      question: `A question about ${name} that could only be asked of this company (${i + 1}).`,
      rationale: `Shows the candidate followed ${name}'s recent direction.`,
    })),
    unavailableNotes: deepDiveUnavailable ? [deepDiveUnavailable] : [],
  };

  return {
    research: {
      resolvedName: name,
      classification: draft.classification,
      findings: `RESOLVED_NAME: ${name}\nSECTOR: ${sector}\n\nFindings about ${name}.`,
      sources: sourceList,
    },
    draft,
  };
}

/** Fixtures keyed by lowercased company name. */
export const BRIEF_FIXTURES: Record<string, BriefFixture> = {
  // Consulting: no 4P, deep dive on engagements and positioning.
  "acme consulting": makeFixture({ name: "Acme Consulting", sector: "consulting" }),

  // FMCG: 4P at full weight — the sector where it is the interview.
  "northwind foods": makeFixture({
    name: "Northwind Foods",
    sector: "fmcg",
    marketingRelevant: true,
    includeFourP: true,
  }),

  // BFSI: 4P omitted rather than filled with generic industry content.
  "meridian bank": makeFixture({ name: "Meridian Bank", sector: "bfsi" }),

  "helios tech": makeFixture({ name: "Helios Tech", sector: "tech" }),

  "vertex group": makeFixture({ name: "Vertex Group", sector: "conglomerate" }),

  // Consumer/D2C lands in `other` and defers to the marketingRelevant signal,
  // which for this fixture resolves 4P on.
  "lumen direct": makeFixture({
    name: "Lumen Direct",
    sector: "other",
    marketingRelevant: true,
    includeFourP: true,
  }),

  // Uncertain classification routes to the general deep dive.
  "obscure holdings": makeFixture({
    name: "Obscure Holdings",
    sector: "consulting",
    confidence: "uncertain",
  }),

  // No relevant recent news found.
  "quiet corp": makeFixture({
    name: "Quiet Corp",
    sector: "tech",
    newsUnavailable: "No recent relevant news was found for this company.",
  }),

  // Deep-dive evidence could not be established.
  "thin evidence ltd": makeFixture({
    name: "Thin Evidence Ltd",
    sector: "other",
    deepDiveUnavailable: "Reliable evidence for a deep dive could not be established.",
  }),
};

export function findFixture(name: string): BriefFixture | undefined {
  return BRIEF_FIXTURES[name.trim().toLowerCase()];
}
