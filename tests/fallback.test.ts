import { describe, expect, it } from "vitest";
import { BriefError, type BriefErrorKind } from "@/lib/brief/errors";
import { withFallback } from "@/lib/providers/fallback";
import type { BriefProvider, ResearchRequest } from "@/lib/providers/types";

const REQUEST: ResearchRequest = {
  company: { requestedName: "Acme", coreName: "Acme" } as ResearchRequest["company"],
  queries: ["acme"],
};

/** A minimal BriefProvider whose research() either succeeds or throws, and counts calls. */
function makeProvider(name: string, behavior: { throws?: BriefErrorKind } = {}) {
  let calls = 0;
  const provider: BriefProvider = {
    name,
    async research() {
      calls += 1;
      if (behavior.throws) throw new BriefError(behavior.throws, `${name} failed`);
      return { resolvedName: name, classification: { sector: "other", confidence: "uncertain", rationale: "", marketingRelevant: false }, findings: `${name} findings`, sources: [] };
    },
    async structure() {
      throw new Error("not used in these tests");
    },
    async researchNews() {
      throw new Error("not used in these tests");
    },
    async structureFromCache() {
      throw new Error("not used in these tests");
    },
  };
  return { provider, callCount: () => calls };
}

describe("withFallback (add-openrouter-fallback-provider task 6.1)", () => {
  it("never calls the fallback when the primary succeeds", async () => {
    const primary = makeProvider("primary");
    const fallback = makeProvider("fallback");
    const wrapped = withFallback(primary.provider, fallback.provider);

    const result = await wrapped.research(REQUEST);

    expect(result.resolvedName).toBe("primary");
    expect(primary.callCount()).toBe(1);
    expect(fallback.callCount()).toBe(0);
  });

  it.each<BriefErrorKind>(["rate_limited", "provider_error", "not_configured", "malformed_response"])(
    "retries via the fallback when the primary fails with %s",
    async (kind) => {
      const primary = makeProvider("primary", { throws: kind });
      const fallback = makeProvider("fallback");
      const wrapped = withFallback(primary.provider, fallback.provider);

      const result = await wrapped.research(REQUEST);

      expect(result.resolvedName).toBe("fallback");
      expect(fallback.callCount()).toBe(1);
    },
  );

  it.each<BriefErrorKind>(["invalid_input", "no_results", "ambiguous"])(
    "does not retry via the fallback when the primary fails with the content-class %s",
    async (kind) => {
      const primary = makeProvider("primary", { throws: kind });
      const fallback = makeProvider("fallback");
      const wrapped = withFallback(primary.provider, fallback.provider);

      await expect(wrapped.research(REQUEST)).rejects.toMatchObject({ kind });
      expect(fallback.callCount()).toBe(0);
    },
  );

  it("propagates the fallback's own error when both providers fail", async () => {
    const primary = makeProvider("primary", { throws: "rate_limited" });
    const fallback = makeProvider("fallback", { throws: "provider_error" });
    const wrapped = withFallback(primary.provider, fallback.provider);

    await expect(wrapped.research(REQUEST)).rejects.toMatchObject({ kind: "provider_error" });
  });

  it("uses only the primary, unwrapped, when fallback is null", async () => {
    const primary = makeProvider("primary", { throws: "rate_limited" });
    const wrapped = withFallback(primary.provider, null);

    expect(wrapped).toBe(primary.provider);
    await expect(wrapped.research(REQUEST)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("withFallback concurrency (add-openrouter-fallback-provider task 6.2)", () => {
  it("keeps two simultaneous calls through one shared wrapper instance independent", async () => {
    // Mirrors compareCompanies()'s concurrent use of a single provider
    // instance - guards the stateless-wrapper decision in design.md. A
    // mutable "last provider used" field on the wrapper would make these
    // two concurrent calls stomp each other; this fails if that regresses.
    let fallbackCalls = 0;
    const primary: BriefProvider = {
      name: "primary",
      async research(request) {
        // Fails only for "FailCo" - lets one shared wrapper instance see
        // both outcomes concurrently.
        if (request.company.requestedName === "FailCo") {
          throw new BriefError("rate_limited", "primary failed for FailCo");
        }
        return {
          resolvedName: request.company.requestedName,
          classification: { sector: "other", confidence: "uncertain", rationale: "", marketingRelevant: false },
          findings: "primary findings",
          sources: [],
        };
      },
      structure: () => Promise.reject(new Error("not used")),
      researchNews: () => Promise.reject(new Error("not used")),
      structureFromCache: () => Promise.reject(new Error("not used")),
    };
    const fallback: BriefProvider = {
      name: "fallback",
      async research() {
        fallbackCalls += 1;
        return {
          resolvedName: "FailCo",
          classification: { sector: "other", confidence: "uncertain", rationale: "", marketingRelevant: false },
          findings: "fallback findings",
          sources: [],
        };
      },
      structure: () => Promise.reject(new Error("not used")),
      researchNews: () => Promise.reject(new Error("not used")),
      structureFromCache: () => Promise.reject(new Error("not used")),
    };

    const wrapped = withFallback(primary, fallback);

    const [okResult, failResult] = await Promise.all([
      wrapped.research({ ...REQUEST, company: { requestedName: "OkCo", coreName: "OkCo" } as ResearchRequest["company"] }),
      wrapped.research({ ...REQUEST, company: { requestedName: "FailCo", coreName: "FailCo" } as ResearchRequest["company"] }),
    ]);

    expect(okResult.resolvedName).toBe("OkCo");
    expect(okResult.findings).toBe("primary findings");
    expect(failResult.resolvedName).toBe("FailCo");
    expect(failResult.findings).toBe("fallback findings");
    expect(fallbackCalls).toBe(1);
  });
});
