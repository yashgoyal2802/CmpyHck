import { describe, expect, it } from "vitest";
import { MAX_CITATIONS_PER_CLAIM, assembleBrief } from "@/lib/brief/assemble";
import { normalizeCompanyName } from "@/lib/brief/normalize";
import { planSections } from "@/lib/brief/plan";
import type { Classification, SourceRef } from "@/lib/brief/types";
import { makeFixture } from "@/fixtures/briefs";
import type { BriefDraft } from "@/lib/providers/draft";

const company = normalizeCompanyName("Testco");
const sources: SourceRef[] = [
  { id: "s1", title: "A source", sourceLabel: "example.com", url: "https://example.com/1" },
];

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    sector: "consulting",
    confidence: "likely",
    rationale: "test",
    marketingRelevant: false,
    ...overrides,
  };
}

function assemble(draft: BriefDraft, cls = classification(), srcs = sources) {
  const plan = planSections(cls);
  return assembleBrief({
    company,
    plan,
    draft,
    sources: srcs,
    generatedAt: "2026-08-04T00:00:00.000Z",
  });
}

function baseDraft(): BriefDraft {
  return structuredClone(makeFixture({ name: "Testco", sector: "consulting" }).draft);
}

describe("source integrity enforcement", () => {
  it("downgrades a 'sourced' claim that cites nothing real to 'inferred'", () => {
    const draft = baseDraft();
    draft.overview = { body: "Claimed as fact.", basis: "sourced", sourceIds: ["s99"] };

    const brief = assemble(draft);

    // The citation does not resolve, so the claim must not be presented as
    // backed by evidence — that is the exact fabrication risk this guards.
    expect(brief.overview.basis).toBe("inferred");
    expect(brief.overview.sourceIds).toEqual([]);
  });

  it("keeps a 'sourced' claim whose citation resolves", () => {
    const draft = baseDraft();
    draft.overview = { body: "Backed by evidence.", basis: "sourced", sourceIds: ["s1"] };

    expect(assemble(draft).overview.basis).toBe("sourced");
  });

  it("strips dangling citations from news items", () => {
    const draft = baseDraft();
    draft.news.items[0].sourceIds = ["s1", "s99"];

    expect(assemble(draft).news.items[0].sourceIds).toEqual(["s1"]);
  });

  it("caps citations per claim so the reader knows which link to open", () => {
    const many: SourceRef[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i + 1}`,
      title: `Source ${i + 1}`,
      sourceLabel: "example.com",
    }));
    const allIds = many.map((s) => s.id);

    const draft = baseDraft();
    draft.overview = { body: "Widely cited.", basis: "sourced", sourceIds: allIds };
    draft.news.items[0].sourceIds = allIds;
    draft.deepDive.topics[0].sourceIds = allIds;

    const brief = assemble(draft, classification(), many);

    expect(brief.overview.sourceIds).toHaveLength(MAX_CITATIONS_PER_CLAIM);
    expect(brief.news.items[0].sourceIds).toHaveLength(MAX_CITATIONS_PER_CLAIM);
    expect(brief.deepDive.topics[0].sourceIds).toHaveLength(MAX_CITATIONS_PER_CLAIM);
    // Order preserved, so the model's own ranking decides which survive.
    expect(brief.overview.sourceIds).toEqual(["s1", "s2", "s3"]);
  });

  it("de-duplicates repeated citations before capping", () => {
    const draft = baseDraft();
    draft.overview = {
      body: "Repeated citation.",
      basis: "sourced",
      sourceIds: ["s1", "s1", "s1"],
    };

    expect(assemble(draft).overview.sourceIds).toEqual(["s1"]);
  });
});

describe("policy enforcement over model output", () => {
  it("replaces a 4P section the model returned for a sector that excludes it with Five Forces", () => {
    const draft = baseDraft();
    draft.framework = {
      kind: "four_p",
      entries: [
        { dimension: "Product", body: "x", basis: "inferred", sourceIds: [] },
        { dimension: "Price", body: "x", basis: "inferred", sourceIds: [] },
        { dimension: "Place", body: "x", basis: "inferred", sourceIds: [] },
        { dimension: "Promotion", body: "x", basis: "inferred", sourceIds: [] },
      ],
    };

    // Consulting excludes 4P; the model does not get to override that, and
    // the brief still gets exactly one framework — Five Forces instead.
    const brief = assemble(draft, classification({ sector: "consulting" }));
    expect(brief.framework.kind).toBe("five_forces");
  });

  it("falls back to a labelled placeholder when 4P applies but was not generated", () => {
    const draft = baseDraft();
    draft.framework = null;

    const brief = assemble(draft, classification({ sector: "fmcg" }));

    expect(brief.framework.kind).toBe("four_p");
    expect(brief.framework.entries.every((e) => e.basis === "inferred")).toBe(true);
    expect(brief.unavailableNotes.join(" ")).toMatch(/4P analysis applies/i);
  });

  it("overrides a model-claimed sector with the planned one", () => {
    const draft = baseDraft();
    draft.classification.sector = "fmcg";

    const brief = assemble(draft, classification({ sector: "bfsi" }));

    expect(brief.classification.sector).toBe("bfsi");
    expect(brief.deepDive.sector).toBe("bfsi");
  });
});

describe("count enforcement", () => {
  it("trims overruns rather than rendering them", () => {
    const draft = baseDraft();
    draft.talkingPoints = [...draft.talkingPoints, ...draft.talkingPoints];
    draft.interviewerQuestions = [
      ...draft.interviewerQuestions,
      ...draft.interviewerQuestions,
    ];

    const brief = assemble(draft);
    expect(brief.talkingPoints).toHaveLength(5);
    expect(brief.interviewerQuestions).toHaveLength(3);
  });

  it("records a shortfall instead of padding it with invented content", () => {
    const draft = baseDraft();
    draft.talkingPoints = draft.talkingPoints.slice(0, 2);
    draft.interviewerQuestions = draft.interviewerQuestions.slice(0, 1);

    const brief = assemble(draft);

    expect(brief.talkingPoints).toHaveLength(2);
    expect(brief.interviewerQuestions).toHaveLength(1);
    expect(brief.unavailableNotes.join(" ")).toMatch(/2 of 5 talking points/i);
    expect(brief.unavailableNotes.join(" ")).toMatch(/1 of 3 interviewer questions/i);
  });

  it("supplies an unavailable message when news is empty and none was given", () => {
    const draft = baseDraft();
    draft.news = { items: [] };

    expect(assemble(draft).news.unavailable).toMatch(/no recent relevant news/i);
  });

  it("notes a deep dive with no topics rather than rendering it empty", () => {
    const draft = baseDraft();
    draft.deepDive.topics = [];

    const brief = assemble(draft);
    expect(brief.deepDive.unavailable).toBeTruthy();
    expect(brief.unavailableNotes.length).toBeGreaterThan(0);
  });

  it("de-duplicates repeated unavailable notes", () => {
    const draft = baseDraft();
    draft.deepDive.topics = [];
    draft.unavailableNotes = ["Repeated note", "Repeated note"];

    const notes = assemble(draft).unavailableNotes;
    expect(new Set(notes).size).toBe(notes.length);
  });
});

describe("assembled output", () => {
  it("keeps the name the user typed alongside the resolved one", () => {
    const draft = baseDraft();
    draft.resolvedName = "Testco Industries Limited";

    const brief = assemble(draft);
    expect(brief.requestedName).toBe("Testco");
    expect(brief.resolvedName).toBe("Testco Industries Limited");
  });

  it("falls back to the typed name when the provider resolved nothing", () => {
    const draft = baseDraft();
    draft.resolvedName = "";

    expect(assemble(draft).resolvedName).toBe("Testco");
  });

  it("carries providerUsed through from the draft (add-openrouter-fallback-provider task 6.3)", () => {
    const draft = baseDraft();
    draft.providerUsed = { name: "openrouter", model: "test-model" };

    expect(assemble(draft).providerUsed).toEqual({ name: "openrouter", model: "test-model" });
  });

  it("leaves providerUsed absent when the draft didn't set one", () => {
    const draft = baseDraft();
    delete draft.providerUsed;

    expect(assemble(draft).providerUsed).toBeUndefined();
  });
});
