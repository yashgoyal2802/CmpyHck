import { describe, expect, it } from "vitest";
import { isBriefError } from "@/lib/brief/errors";
import { generateBrief } from "@/lib/brief/pipeline";
import {
  INTERVIEWER_QUESTION_COUNT,
  NEWS_MAX,
  NEWS_MIN,
  TALKING_POINT_COUNT,
} from "@/lib/brief/types";
import { createFakeProvider } from "@/lib/providers/fake";

const provider = createFakeProvider();
const now = () => new Date("2026-08-04T00:00:00.000Z");

async function brief(name: string) {
  return generateBrief(name, { provider, now });
}

describe("brief generation (task 5.3)", () => {
  it("produces a complete brief with resolved source references", async () => {
    const result = await brief("Acme Consulting");

    expect(result.requestedName).toBe("Acme Consulting");
    expect(result.resolvedName).toBe("Acme Consulting");
    expect(result.generatedAt).toBe("2026-08-04T00:00:00.000Z");
    expect(result.overview.body).toBeTruthy();
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("cites only source ids that resolve to a real source", async () => {
    const result = await brief("Acme Consulting");
    const validIds = new Set(result.sources.map((s) => s.id));

    const allCited = [
      ...result.overview.sourceIds,
      ...result.news.items.flatMap((i) => i.sourceIds),
      ...result.deepDive.topics.flatMap((t) => t.sourceIds),
      ...result.talkingPoints.flatMap((p) => p.sourceIds),
    ];

    expect(allCited.length).toBeGreaterThan(0);
    for (const id of allCited) expect(validIds.has(id)).toBe(true);
  });

  it("separates sourced facts from generated analysis", async () => {
    const result = await brief("Acme Consulting");
    const bases = result.deepDive.topics.map((t) => t.basis);

    expect(bases).toContain("sourced");
    expect(bases).toContain("inferred");
    // A sourced claim always carries at least one citation.
    for (const topic of result.deepDive.topics) {
      if (topic.basis === "sourced") expect(topic.sourceIds.length).toBeGreaterThan(0);
    }
  });
});

describe("recent news (tasks 5.4, 5.5)", () => {
  it("returns between the configured minimum and maximum items", async () => {
    const result = await brief("Acme Consulting");
    expect(result.news.items.length).toBeGreaterThanOrEqual(NEWS_MIN);
    expect(result.news.items.length).toBeLessThanOrEqual(NEWS_MAX);
  });

  it("gives every item an interview-relevance explanation", async () => {
    const result = await brief("Acme Consulting");
    for (const item of result.news.items) {
      expect(item.whyItMatters.trim().length).toBeGreaterThan(0);
    }
  });

  it("caps overruns at the maximum rather than rendering them all", async () => {
    const flooded = createFakeProvider({
      fixtures: {
        "flood corp": await import("@/fixtures/briefs").then((m) =>
          m.makeFixture({ name: "Flood Corp", sector: "tech", newsCount: 12 }),
        ),
      },
    });
    const result = await generateBrief("Flood Corp", { provider: flooded, now });
    expect(result.news.items).toHaveLength(NEWS_MAX);
  });

  it("states that no relevant news was found instead of inventing updates", async () => {
    const result = await brief("Quiet Corp");
    expect(result.news.items).toHaveLength(0);
    expect(result.news.unavailable).toMatch(/no recent relevant news/i);
  });
});

describe("fixed section counts (task 5.8)", () => {
  it("produces exactly 5 talking points and 3 interviewer questions", async () => {
    const result = await brief("Acme Consulting");
    expect(result.talkingPoints).toHaveLength(TALKING_POINT_COUNT);
    expect(result.interviewerQuestions).toHaveLength(INTERVIEWER_QUESTION_COUNT);
  });

  it("gives every interviewer question a rationale", async () => {
    const result = await brief("Acme Consulting");
    for (const question of result.interviewerQuestions) {
      expect(question.rationale.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("provider failures (task 5.9)", () => {
  it("surfaces rate limiting as retryable, distinct from a generic failure", async () => {
    const limited = createFakeProvider({ failWith: { kind: "rate_limited" } });
    try {
      await generateBrief("Acme Consulting", { provider: limited, now });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(isBriefError(error)).toBe(true);
      if (!isBriefError(error)) return;
      expect(error.kind).toBe("rate_limited");
      expect(error.retryable).toBe(true);
      expect(error.retryAfterSeconds).toBe(30);
    }
  });

  it("surfaces a provider error as retryable", async () => {
    const failing = createFakeProvider({ failWith: { kind: "provider_error" } });
    await expect(
      generateBrief("Acme Consulting", { provider: failing, now }),
    ).rejects.toMatchObject({ kind: "provider_error", retryable: true });
  });

  it("surfaces no-results as non-retryable, since retrying changes nothing", async () => {
    const empty = createFakeProvider({ failWith: { kind: "no_results" } });
    await expect(
      generateBrief("Acme Consulting", { provider: empty, now }),
    ).rejects.toMatchObject({ kind: "no_results", retryable: false });
  });

  it("fails on a structuring-stage error without emitting a partial brief", async () => {
    const failing = createFakeProvider({
      failWith: { kind: "malformed_response", stage: "structure" },
    });
    await expect(
      generateBrief("Acme Consulting", { provider: failing, now }),
    ).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("rejects an empty submission before calling the provider at all", async () => {
    let called = false;
    const spy = createFakeProvider();
    const watched = {
      ...spy,
      research: async (...args: Parameters<typeof spy.research>) => {
        called = true;
        return spy.research(...args);
      },
    };

    await expect(generateBrief("   ", { provider: watched, now })).rejects.toMatchObject(
      { kind: "invalid_input" },
    );
    expect(called).toBe(false);
  });
});
