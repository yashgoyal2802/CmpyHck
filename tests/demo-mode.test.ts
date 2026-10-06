import { describe, expect, it } from "vitest";
import { generateBrief } from "@/lib/brief/pipeline";
import { createFakeProvider } from "@/lib/providers/fake";

/**
 * Exercises the exact provider construction and generateBrief call shape
 * `src/app/api/briefs/route.ts` uses for a demo session (task 4) - the route
 * handler itself isn't unit-tested anywhere in this codebase (no test
 * imports a route handler directly), so this validates the underlying
 * behavior the route relies on instead.
 */
describe("demo-mode fixture search (add-demo-mode task 4.2)", () => {
  function demoProvider() {
    return createFakeProvider({ fallbackToGeneric: false });
  }

  it("resolves a known fixture company, with no storage/caching involved", async () => {
    // Deliberately no `storage` option - mirrors the route calling
    // generateBrief without it for a demo session, so no DB read/write ever
    // happens (see pipeline.ts: storage omitted means no caching at all).
    const brief = await generateBrief("Acme Consulting", { provider: demoProvider() });
    expect(brief.resolvedName).toBeTruthy();
    expect(brief.cache).toBeUndefined();
  });

  it("surfaces the real no_results outcome for an unrecognized name, not a fabricated generic brief", async () => {
    await expect(
      generateBrief("Some Company Nobody Has Heard Of Xyz123", { provider: demoProvider() }),
    ).rejects.toMatchObject({ kind: "no_results" });
  });
});
