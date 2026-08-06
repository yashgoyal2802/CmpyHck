import { describe, expect, it } from "vitest";
import {
  mapGroundingToSources,
  parseResearchText,
} from "@/lib/providers/grounding";
import { translateGeminiError } from "@/lib/providers/gemini";

describe("grounding metadata to source references (task 2.4)", () => {
  it("preserves title, url and source label, and assigns stable ids", () => {
    const sources = mapGroundingToSources({
      groundingChunks: [
        { web: { uri: "https://economictimes.com/a", title: "Deal signed", domain: "economictimes.com" } },
        { web: { uri: "https://moneycontrol.com/b", title: "Q1 results" } },
      ],
    });

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      id: "s1",
      title: "Deal signed",
      url: "https://economictimes.com/a",
      sourceLabel: "economictimes.com",
    });
    // Falls back to the hostname when the provider omits a domain.
    expect(sources[1].sourceLabel).toBe("moneycontrol.com");
    expect(sources[1].id).toBe("s2");
  });

  it("labels redirect-proxied sources by publisher, not by the redirect host", () => {
    // Gemini returns its own grounding-redirect URI and puts the publisher
    // domain in `title`. Using the URL hostname would label every source
    // "vertexaisearch.cloud.google.com" and make source-checking impossible.
    const sources = mapGroundingToSources({
      groundingChunks: [
        {
          web: {
            uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIabc123",
            title: "business-standard.com",
          },
        },
      ],
    });

    expect(sources[0].sourceLabel).toBe("business-standard.com");
    expect(sources[0].sourceLabel).not.toContain("vertexaisearch");
    // The redirect URL is still the working link to the page.
    expect(sources[0].url).toContain("vertexaisearch.cloud.google.com");
  });

  it("de-duplicates repeated pages", () => {
    const sources = mapGroundingToSources({
      groundingChunks: [
        { web: { uri: "https://a.com/1", title: "One" } },
        { web: { uri: "https://a.com/1", title: "One" } },
      ],
    });
    expect(sources).toHaveLength(1);
  });

  it("drops chunks with no usable content", () => {
    const sources = mapGroundingToSources({
      groundingChunks: [{ web: null }, {}, { web: { uri: "", title: "" } }],
    });
    expect(sources).toHaveLength(0);
  });

  it("returns an empty list when there is no metadata at all", () => {
    expect(mapGroundingToSources(undefined)).toEqual([]);
    expect(mapGroundingToSources(null)).toEqual([]);
    expect(mapGroundingToSources({})).toEqual([]);
  });
});

describe("research report parsing", () => {
  const report = `RESOLVED_NAME: Hindustan Unilever Limited
AMBIGUOUS: no
NO_RESULTS: no
SECTOR: fmcg
CONFIDENCE: likely
MARKETING_RELEVANT: yes
CLASSIFICATION_RATIONALE: Interviews centre on brands and distribution.

OVERVIEW: A large consumer goods company.`;

  it("reads the labelled fields", () => {
    const parsed = parseResearchText(report);
    expect(parsed.resolvedName).toBe("Hindustan Unilever Limited");
    expect(parsed.classification.sector).toBe("fmcg");
    expect(parsed.classification.confidence).toBe("likely");
    expect(parsed.classification.marketingRelevant).toBe(true);
    expect(parsed.noResults).toBe(false);
    expect(parsed.ambiguousCandidates).toBeUndefined();
  });

  it("degrades an unrecognised sector to uncertain rather than failing", () => {
    const parsed = parseResearchText("SECTOR: aerospace\nCONFIDENCE: likely");
    expect(parsed.classification.sector).toBe("other");
    expect(parsed.classification.confidence).toBe("uncertain");
  });

  it("treats a missing confidence as uncertain", () => {
    const parsed = parseResearchText("SECTOR: bfsi");
    expect(parsed.classification.sector).toBe("bfsi");
    expect(parsed.classification.confidence).toBe("uncertain");
  });

  it("captures ambiguity candidates", () => {
    const parsed = parseResearchText("AMBIGUOUS: Acme Foods | Acme Steel\nSECTOR: other");
    expect(parsed.ambiguousCandidates).toEqual(["Acme Foods", "Acme Steel"]);
  });

  it("reads a no-results signal", () => {
    expect(parseResearchText("NO_RESULTS: yes").noResults).toBe(true);
    expect(parseResearchText("NO_RESULTS: no").noResults).toBe(false);
  });
});

describe("provider error translation (task 2.6)", () => {
  it("maps a 429 to rate_limited", () => {
    const error = translateGeminiError(Object.assign(new Error("too many"), { status: 429 }));
    expect(error.kind).toBe("rate_limited");
    expect(error.retryable).toBe(true);
  });

  it("maps quota language to rate_limited even without a status code", () => {
    expect(translateGeminiError(new Error("RESOURCE_EXHAUSTED: quota")).kind).toBe(
      "rate_limited",
    );
  });

  it("extracts a retry-after hint when the provider gives one", () => {
    const error = translateGeminiError(new Error("quota exceeded, retry after 42 seconds"));
    expect(error.retryAfterSeconds).toBe(42);
  });

  it("maps auth failures to not_configured, which is not retryable", () => {
    const error = translateGeminiError(Object.assign(new Error("bad key"), { status: 403 }));
    expect(error.kind).toBe("not_configured");
    expect(error.retryable).toBe(false);
  });

  it("maps anything else to a retryable provider error", () => {
    expect(translateGeminiError(new Error("socket hang up")).kind).toBe("provider_error");
  });
});
