import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeCompanyName } from "@/lib/brief/normalize";
import { planSections } from "@/lib/brief/plan";
import { createOpenRouterProvider } from "@/lib/providers/openrouter";
import type { ResearchResult, StructureRequest } from "@/lib/providers/types";

const company = normalizeCompanyName("Acme Consulting");
const plan = planSections({ sector: "consulting", confidence: "likely", rationale: "test", marketingRelevant: false });

/** Fixed response that research-stage tests don't actually depend on, for building a StructureRequest. */
function fakeResearch(): ResearchResult {
  return {
    resolvedName: "Acme Consulting",
    classification: { sector: "consulting", confidence: "likely", rationale: "test", marketingRelevant: false },
    findings: "Acme Consulting is a consulting firm.",
    sources: [{ id: "s1", title: "Acme site", url: "https://acme.example/about", sourceLabel: "acme.example" }],
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const VALID_DRAFT_JSON = {
  resolvedName: "Acme Consulting",
  overview: { body: "Acme does consulting.", basis: "sourced", sourceIds: ["s1"] },
  classification: { sector: "consulting", confidence: "likely", rationale: "test", marketingRelevant: false },
  news: { items: [], unavailable: "none" },
  deepDive: { heading: "Deep dive", topics: [] },
  framework: null,
  talkingPoints: [],
  interviewerQuestions: [],
  unavailableNotes: [],
};

describe("OpenRouter provider (add-openrouter-fallback-provider task 6.4)", () => {
  const provider = createOpenRouterProvider({ apiKey: "or-key", model: "test/model:free", tavilyApiKey: "tv-key" });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockOpenRouterContent(content: string) {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("openrouter.ai")) {
        return jsonResponse(200, { choices: [{ message: { content } }] });
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
  }

  it("structure() returns a valid draft tagged with providerUsed", async () => {
    mockOpenRouterContent(JSON.stringify(VALID_DRAFT_JSON));

    const request: StructureRequest = { company, research: fakeResearch(), plan };
    const draft = await provider.structure(request);

    expect(draft.resolvedName).toBe("Acme Consulting");
    expect(draft.providerUsed).toEqual({ name: "openrouter", model: "test/model:free" });
  });

  it("structure() throws malformed_response on invalid JSON", async () => {
    mockOpenRouterContent("not json at all");

    const request: StructureRequest = { company, research: fakeResearch(), plan };
    await expect(provider.structure(request)).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("structure() throws malformed_response when JSON doesn't match the schema", async () => {
    mockOpenRouterContent(JSON.stringify({ unrelated: "shape" }));

    const request: StructureRequest = { company, research: fakeResearch(), plan };
    await expect(provider.structure(request)).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("structure() throws malformed_response on an empty response", async () => {
    mockOpenRouterContent("");

    const request: StructureRequest = { company, research: fakeResearch(), plan };
    await expect(provider.structure(request)).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("research() throws no_results when Tavily returns nothing", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("tavily.com")) return jsonResponse(200, { results: [] });
      throw new Error(`unexpected fetch to ${url}`);
    });

    await expect(
      provider.research({ company, queries: ["acme consulting overview"] }),
    ).rejects.toMatchObject({ kind: "no_results" });
  });

  it("translates a Tavily 429 into rate_limited", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("tavily.com")) return jsonResponse(429, { error: "rate limited" }, { "retry-after": "12" });
      throw new Error(`unexpected fetch to ${url}`);
    });

    const error = await provider
      .research({ company, queries: ["acme consulting overview"] })
      .catch((e) => e);
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 12 });
  });

  it("translates an OpenRouter 401 into not_configured", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("tavily.com")) {
        return jsonResponse(200, {
          results: [{ url: "https://acme.example/about", title: "Acme", content: "Acme is a firm." }],
        });
      }
      if (url.includes("openrouter.ai")) return jsonResponse(401, { error: "bad key" });
      // Page fetch for the one Tavily result - fail it harmlessly so research() falls through to the OpenRouter call.
      return new Response("", { status: 500 });
    });

    const error = await provider
      .research({ company, queries: ["acme consulting overview"] })
      .catch((e) => e);
    expect(error).toMatchObject({ kind: "not_configured" });
  });
});
