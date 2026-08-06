import { describe, expect, it } from "vitest";
import {
  InvalidComparisonError,
  compareCompanies,
} from "@/lib/brief/compare";
import { createFakeProvider } from "@/lib/providers/fake";
import { createMemoryStorage } from "@/lib/storage/memory";

describe("company comparison (tasks 7.12-7.14)", () => {
  it("rejects fewer than two companies", async () => {
    const provider = createFakeProvider();
    await expect(
      compareCompanies(["Acme Consulting"], { provider }),
    ).rejects.toBeInstanceOf(InvalidComparisonError);
  });

  it("rejects more than three companies", async () => {
    const provider = createFakeProvider();
    await expect(
      compareCompanies(
        ["Acme Consulting", "Quiet Corp", "Acme Consulting", "Quiet Corp"],
        { provider },
      ),
    ).rejects.toBeInstanceOf(InvalidComparisonError);
  });

  it("generates a brief per company, reusing the cache exactly as a standalone search would", async () => {
    const provider = createFakeProvider();
    const storage = createMemoryStorage();

    const results = await compareCompanies(["Acme Consulting", "Quiet Corp"], {
      provider,
      storage,
    });

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.brief).toBeDefined();
      expect(result.brief?.cache).toMatchObject({ fromCache: false });
    }

    const repeat = await compareCompanies(["Acme Consulting", "Quiet Corp"], {
      provider,
      storage,
    });
    for (const result of repeat) {
      expect(result.brief?.cache).toMatchObject({ fromCache: true });
    }
  });

  it("does not let one company's research failure block the others", async () => {
    const provider = createFakeProvider({ fallbackToGeneric: false });

    const results = await compareCompanies(["Acme Consulting", "Nonexistent Corp"], {
      provider,
    });

    expect(results).toHaveLength(2);
    const acme = results.find((r) => r.companyName === "Acme Consulting");
    const missing = results.find((r) => r.companyName === "Nonexistent Corp");

    expect(acme?.brief).toBeDefined();
    expect(acme?.error).toBeUndefined();
    expect(missing?.brief).toBeUndefined();
    expect(missing?.error).toBeDefined();
  });

  it("compares exactly three companies when three are given", async () => {
    const provider = createFakeProvider();
    const results = await compareCompanies(
      ["Acme Consulting", "Quiet Corp", "Acme Consulting"],
      { provider },
    );
    expect(results).toHaveLength(3);
  });
});
