/**
 * MBA-relevant sector classification.
 *
 * Deliberately NOT service-vs-product: that distinction is an engineering-campus
 * one and does not predict what an MBA interview probes. These buckets do.
 */
export const SECTORS = [
  "consulting",
  "fmcg",
  "bfsi",
  "tech",
  "conglomerate",
  "other",
] as const;

export type Sector = (typeof SECTORS)[number];

/**
 * Whether 4P analysis is generated for a sector.
 *
 * - `always`  : marketing framing drives the interview, generate at full weight
 * - `never`   : 4P adds little; omit rather than fill with generic industry content
 * - `byRoleRelevance` : defer to the classifier's `marketingRelevant` signal
 *                       (covers retail / D2C / consumer-tech, which land in `other`)
 */
export type FourPPolicy = "always" | "never" | "byRoleRelevance";

export interface SectorPolicy {
  /** Human-readable sector name shown in the brief. */
  label: string;
  /** Heading for the sector-specific deep dive section. */
  deepDiveHeading: string;
  /** Themes this sector's interviews typically probe; drives the research prompt. */
  themes: string[];
  fourP: FourPPolicy;
}

export const SECTOR_POLICY: Record<Sector, SectorPolicy> = {
  consulting: {
    label: "Consulting",
    deepDiveHeading: "Engagements, practice areas & positioning",
    themes: [
      "recent client engagements, deal wins, or delivery signals",
      "practice areas and sector strengths",
      "how the firm positions itself against peer firms",
    ],
    fourP: "never",
  },
  fmcg: {
    label: "FMCG",
    deepDiveHeading: "Brand portfolio & go-to-market",
    themes: [
      "brand portfolio and recent launches or relaunches",
      "go-to-market, distribution and channel strategy",
      "pricing, premiumisation and volume-vs-value dynamics",
    ],
    fourP: "always",
  },
  bfsi: {
    label: "BFSI",
    deepDiveHeading: "Regulation, financial arc & digital strategy",
    themes: [
      "regulatory developments affecting the business",
      "the recent financial performance arc and what it signals about direction",
      "digital, technology and product strategy",
    ],
    fourP: "never",
  },
  tech: {
    label: "Technology / Product",
    deepDiveHeading: "Product direction, moat & monetization",
    themes: [
      "product direction and roadmap signals",
      "competitive moat and differentiation",
      "monetization or platform strategy",
    ],
    fourP: "never",
  },
  conglomerate: {
    label: "Conglomerate / General Management",
    deepDiveHeading: "Group structure, capital allocation & priorities",
    themes: [
      "group structure and how the businesses relate",
      "capital allocation and recent investment or divestment moves",
      "business unit priorities and where growth is being pushed",
    ],
    fourP: "never",
  },
  other: {
    label: "General business",
    deepDiveHeading: "Business context & strategic direction",
    themes: [
      "business model and how the company makes money",
      "competitive position and recent strategic direction",
      "the themes an interviewer would most likely probe",
    ],
    fourP: "byRoleRelevance",
  },
};

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}

/**
 * Resolve whether the 4P section applies.
 *
 * `marketingRelevant` is the classifier's judgement on whether marketing framing
 * drives this company's interviews; it only decides the `byRoleRelevance` case.
 */
export function fourPApplies(sector: Sector, marketingRelevant: boolean): boolean {
  const policy = SECTOR_POLICY[sector].fourP;
  if (policy === "always") return true;
  if (policy === "never") return false;
  return marketingRelevant;
}

export function sectorLabel(sector: Sector): string {
  return SECTOR_POLICY[sector].label;
}
