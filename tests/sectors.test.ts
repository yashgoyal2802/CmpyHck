import { describe, expect, it } from "vitest";
import { planSections } from "@/lib/brief/plan";
import { generateBrief } from "@/lib/brief/pipeline";
import { SECTOR_POLICY, fourPApplies } from "@/lib/brief/sectors";
import type { Classification } from "@/lib/brief/types";
import { createFakeProvider } from "@/lib/providers/fake";

const provider = createFakeProvider();
const now = () => new Date("2026-08-04T00:00:00.000Z");
const brief = (name: string) => generateBrief(name, { provider, now });

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    sector: "other",
    confidence: "likely",
    rationale: "test",
    marketingRelevant: false,
    ...overrides,
  };
}

describe("sector classification drives section selection (task 5.6)", () => {
  it("classifies consulting and uses its deep dive", async () => {
    const result = await brief("Acme Consulting");
    expect(result.classification.sector).toBe("consulting");
    expect(result.deepDive.sector).toBe("consulting");
    expect(result.deepDive.heading).toBe(SECTOR_POLICY.consulting.deepDiveHeading);
  });

  it("classifies FMCG and uses its deep dive", async () => {
    const result = await brief("Northwind Foods");
    expect(result.classification.sector).toBe("fmcg");
    expect(result.deepDive.heading).toBe(SECTOR_POLICY.fmcg.deepDiveHeading);
  });

  it("classifies BFSI and uses its deep dive", async () => {
    const result = await brief("Meridian Bank");
    expect(result.classification.sector).toBe("bfsi");
    expect(result.deepDive.heading).toBe(SECTOR_POLICY.bfsi.deepDiveHeading);
  });

  it("gives each sector a distinct deep-dive heading", async () => {
    const headings = await Promise.all(
      ["Acme Consulting", "Northwind Foods", "Meridian Bank", "Helios Tech"].map(
        async (name) => (await brief(name)).deepDive.heading,
      ),
    );
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("falls back to the general deep dive when classification is uncertain", async () => {
    const result = await brief("Obscure Holdings");
    // The fixture claims consulting, but low confidence routes to the fallback
    // rather than asserting sector detail the evidence does not support.
    expect(result.deepDive.usedFallback).toBe(true);
    expect(result.deepDive.sector).toBe("other");
    expect(result.classification.sector).toBe("other");
  });

  it("reports when deep-dive evidence could not be established", async () => {
    const result = await brief("Thin Evidence Ltd");
    expect(result.deepDive.unavailable).toBeTruthy();
    expect(result.unavailableNotes.length).toBeGreaterThan(0);
  });
});

describe("conditional 4P analysis (task 5.7)", () => {
  it("includes 4P for FMCG, the sector where it is the interview", async () => {
    const result = await brief("Northwind Foods");
    expect(result.fourP).not.toBeNull();
    expect(result.fourP?.entries.map((e) => e.dimension)).toEqual([
      "Product",
      "Price",
      "Place",
      "Promotion",
    ]);
  });

  it("omits 4P for BFSI rather than filling it with generic content", async () => {
    const result = await brief("Meridian Bank");
    expect(result.fourP).toBeNull();
  });

  it("omits 4P for consulting, tech and conglomerate", async () => {
    for (const name of ["Acme Consulting", "Helios Tech", "Vertex Group"]) {
      expect((await brief(name)).fourP).toBeNull();
    }
  });

  it("labels industry-level 4P reasoning as inferred, not as fact", async () => {
    const result = await brief("Northwind Foods");
    const entries = result.fourP?.entries ?? [];

    expect(entries.some((e) => e.basis === "inferred")).toBe(true);
    expect(entries.some((e) => e.basis === "sourced")).toBe(true);
    for (const entry of entries) {
      if (entry.basis === "inferred") expect(entry.sourceIds).toHaveLength(0);
      if (entry.basis === "sourced") expect(entry.sourceIds.length).toBeGreaterThan(0);
    }
  });

  it("includes 4P for a marketing-relevant company in the 'other' bucket", async () => {
    // Retail / D2C / consumer-tech land in `other`; the classifier's
    // marketingRelevant signal decides, per the byRoleRelevance policy.
    const result = await brief("Lumen Direct");
    expect(result.classification.sector).toBe("other");
    expect(result.fourP).not.toBeNull();
  });
});

describe("4P policy", () => {
  it("applies always for FMCG regardless of the marketing signal", () => {
    expect(fourPApplies("fmcg", false)).toBe(true);
    expect(fourPApplies("fmcg", true)).toBe(true);
  });

  it("never applies for BFSI, even if the model claims marketing relevance", () => {
    expect(fourPApplies("bfsi", true)).toBe(false);
  });

  it("defers to the marketing signal only for the 'other' bucket", () => {
    expect(fourPApplies("other", true)).toBe(true);
    expect(fourPApplies("other", false)).toBe(false);
  });
});

describe("section planning", () => {
  it("routes an uncertain classification to the general plan", () => {
    const plan = planSections(classification({ sector: "fmcg", confidence: "uncertain" }));
    expect(plan.sector).toBe("other");
    expect(plan.usedFallback).toBe(true);
    // An uncertain FMCG call must not carry FMCG's automatic 4P with it.
    expect(plan.includeFourP).toBe(false);
  });

  it("keeps 4P for an uncertain classification that is still marketing-led", () => {
    const plan = planSections(
      classification({ sector: "fmcg", confidence: "uncertain", marketingRelevant: true }),
    );
    expect(plan.sector).toBe("other");
    expect(plan.includeFourP).toBe(true);
  });
});
