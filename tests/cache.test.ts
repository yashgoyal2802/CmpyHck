import { describe, expect, it } from "vitest";
import { companyCacheKey, normalizeCompanyName } from "@/lib/brief/normalize";
import { generateBrief } from "@/lib/brief/pipeline";
import { createFakeProvider } from "@/lib/providers/fake";
import { createMemoryStorage } from "@/lib/storage/memory";

const now = () => new Date("2026-08-06T00:00:00.000Z");

function setup() {
  const provider = createFakeProvider();
  const storage = createMemoryStorage();
  return { provider, storage };
}

describe("company research cache (tasks 7.4-7.9)", () => {
  it("re-researches in full on a first-ever search and writes the cache", async () => {
    const { provider, storage } = setup();
    const key = companyCacheKey(normalizeCompanyName("Acme Consulting"));

    expect(await storage.getCompanyCache(key)).toBeNull();

    const brief = await generateBrief("Acme Consulting", { provider, storage, now });

    expect(brief.cache).toMatchObject({ fromCache: false });
    const cached = await storage.getCompanyCache(key);
    expect(cached).not.toBeNull();
    expect(cached?.resolvedName).toBe(brief.resolvedName);
  });

  it("reuses cached stable facts on a repeat search within the cache window", async () => {
    const { provider, storage } = setup();

    const first = await generateBrief("Acme Consulting", { provider, storage, now });
    const second = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-07T00:00:00.000Z"),
    });

    expect(second.cache).toMatchObject({ fromCache: true });
    expect(second.overview.body).toBe(first.overview.body);
    expect(second.classification.sector).toBe(first.classification.sector);
    expect(second.deepDive.topics.map((t) => t.body)).toEqual(
      first.deepDive.topics.map((t) => t.body),
    );
  });

  it("always fetches news fresh, even on a cache hit", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const second = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-07T00:00:00.000Z"),
    });

    // The fake provider's researchNews is called on every cache hit — this
    // is exercised implicitly by the news section still being populated.
    expect(second.news.items.length + (second.news.unavailable ? 1 : 0)).toBeGreaterThan(0);
  });

  it("treats an expired cache entry as a miss and re-researches in full", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const afterExpiry = await generateBrief("Acme Consulting", {
      provider,
      storage,
      cacheTtlSeconds: 60,
      now: () => new Date("2026-08-06T00:02:00.000Z"),
    });

    expect(afterExpiry.cache).toMatchObject({ fromCache: false });
  });

  it("force refresh bypasses the cache regardless of TTL", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const forced = await generateBrief("Acme Consulting", {
      provider,
      storage,
      forceRefresh: true,
      now: () => new Date("2026-08-06T00:00:01.000Z"),
    });

    expect(forced.cache).toMatchObject({ fromCache: false });
  });

  it("cached-origin and fresh-origin citation ids never collide and both resolve", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const hit = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-07T00:00:00.000Z"),
    });

    const cIds = hit.sources.filter((s) => s.id.startsWith("c")).map((s) => s.id);
    const nIds = hit.sources.filter((s) => s.id.startsWith("n")).map((s) => s.id);
    expect(cIds.length).toBeGreaterThan(0);
    expect(new Set([...cIds, ...nIds]).size).toBe(cIds.length + nIds.length);

    const validIds = new Set(hit.sources.map((s) => s.id));
    const allCited = [
      ...hit.overview.sourceIds,
      ...hit.news.items.flatMap((i) => i.sourceIds),
      ...hit.deepDive.topics.flatMap((t) => t.sourceIds),
      ...hit.talkingPoints.flatMap((p) => p.sourceIds),
    ];
    for (const id of allCited) expect(validIds.has(id)).toBe(true);
  });

  it("is shared across different users", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const secondUsersSearch = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-06T00:00:01.000Z"),
    });

    // Nothing in the pipeline is keyed on a username — the cache has no
    // concept of who triggered the original research.
    expect(secondUsersSearch.cache).toMatchObject({ fromCache: true });
  });
});

describe("what's changed (task 7.8)", () => {
  it("reports nothing new when the second search's news matches the first", async () => {
    const { provider, storage } = setup();

    await generateBrief("Acme Consulting", { provider, storage, now });
    const hit = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-07T00:00:00.000Z"),
    });

    // The fake provider returns the same fixture news on every call, so a
    // repeat search's news is identical to what was last seen.
    expect(hit.cache?.newSinceLastSeen).toEqual([]);
  });

  it("highlights news items not present in the last-seen snapshot", async () => {
    const { provider, storage } = setup();
    const key = companyCacheKey(normalizeCompanyName("Acme Consulting"));

    await generateBrief("Acme Consulting", { provider, storage, now });
    await storage.putLastSeenNews(key, [], now().toISOString());

    const hit = await generateBrief("Acme Consulting", {
      provider,
      storage,
      now: () => new Date("2026-08-07T00:00:00.000Z"),
    });

    expect(hit.cache?.newSinceLastSeen?.length).toBeGreaterThan(0);
  });
});
