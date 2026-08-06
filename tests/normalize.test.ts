import { describe, expect, it } from "vitest";
import { isBriefError } from "@/lib/brief/errors";
import {
  MAX_COMPANY_NAME_LENGTH,
  buildResearchQueries,
  normalizeCompanyName,
} from "@/lib/brief/normalize";

describe("company name validation (task 5.1)", () => {
  it("rejects an empty name", () => {
    expect(() => normalizeCompanyName("")).toThrowError(/required/i);
  });

  it("rejects a whitespace-only name", () => {
    expect(() => normalizeCompanyName("   \n\t  ")).toThrowError(/required/i);
  });

  it("rejects a non-string submission", () => {
    expect(() => normalizeCompanyName(undefined)).toThrowError(/must be text/i);
    expect(() => normalizeCompanyName(42)).toThrowError(/must be text/i);
  });

  it("raises invalid_input, which the route maps to HTTP 400", () => {
    try {
      normalizeCompanyName("  ");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(isBriefError(error)).toBe(true);
      if (isBriefError(error)) expect(error.kind).toBe("invalid_input");
    }
  });

  it("rejects an over-long name rather than sending it to the provider", () => {
    const tooLong = "a".repeat(MAX_COMPANY_NAME_LENGTH + 1);
    expect(() => normalizeCompanyName(tooLong)).toThrowError(/characters or fewer/i);
  });

  it("accepts a valid name and preserves what the user typed", () => {
    const result = normalizeCompanyName("  Hindustan   Unilever  ");
    expect(result.requestedName).toBe("Hindustan Unilever");
  });
});

describe("legal-suffix stripping", () => {
  it("strips a single suffix for search while keeping the typed name", () => {
    const result = normalizeCompanyName("Asian Paints Limited");
    expect(result.requestedName).toBe("Asian Paints Limited");
    expect(result.coreName).toBe("Asian Paints");
  });

  it("strips stacked suffixes", () => {
    expect(normalizeCompanyName("Acme Pvt Ltd").coreName).toBe("Acme");
  });

  it("handles comma-separated suffixes", () => {
    expect(normalizeCompanyName("Nestle, Inc.").coreName).toBe("Nestle");
  });

  it("never strips a name down to nothing", () => {
    expect(normalizeCompanyName("Limited").coreName).toBe("Limited");
  });
});

describe("research query construction", () => {
  it("biases queries toward placement-relevant signals", () => {
    const queries = buildResearchQueries(normalizeCompanyName("Infosys Limited"));
    expect(queries.length).toBeGreaterThan(1);
    // Uses the core name, not the legal form.
    expect(queries.every((q) => q.includes("Infosys"))).toBe(true);
    expect(queries.some((q) => /hiring|campus/i.test(q))).toBe(true);
    expect(queries.some((q) => /strategy|deal|results/i.test(q))).toBe(true);
  });
});
