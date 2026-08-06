import type { NewsItem, SourceRef } from "./types";

/** Default cache lifetime for a company's stable facts. Tunable via CACHE_TTL_SECONDS. */
export const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export function isCacheFresh(cachedAt: string, ttlSeconds: number, now: Date): boolean {
  const cachedAtMs = Date.parse(cachedAt);
  if (Number.isNaN(cachedAtMs)) return false;
  return now.getTime() - cachedAtMs < ttlSeconds * 1000;
}

/**
 * Re-number a source list under a fresh origin prefix and return the id
 * remapping, so citations minted against the old ids can be rewritten to
 * match. This is what keeps cached-origin (`c1, c2, ...`) and fresh-origin
 * (`n1, n2, ...`) source ids from ever colliding when a cache hit merges
 * both batches into one brief (see design.md).
 */
export function reprefixSources(
  sources: SourceRef[],
  prefix: string,
): { sources: SourceRef[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const reprefixed = sources.map((source, index) => {
    const id = `${prefix}${index + 1}`;
    idMap.set(source.id, id);
    return { ...source, id };
  });
  return { sources: reprefixed, idMap };
}

/** Rewrite a claim-like object's sourceIds through an id remapping, dropping ids with no mapping. */
export function remapSourceIds<T extends { sourceIds: string[] }>(
  claim: T,
  idMap: Map<string, string>,
): T {
  return {
    ...claim,
    sourceIds: claim.sourceIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
  };
}

/**
 * News items in `current` not present (by normalized title) in `previous`.
 * The comparison is deliberately coarse — exact title matching — because the
 * only thing this feeds is a "here's what's new" prompt, not a citation.
 */
export function diffNews(previous: NewsItem[], current: NewsItem[]): NewsItem[] {
  const seen = new Set(previous.map((item) => normalizeTitle(item.title)));
  return current.filter((item) => !seen.has(normalizeTitle(item.title)));
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}
