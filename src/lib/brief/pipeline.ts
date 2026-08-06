import type { BriefDraft } from "@/lib/providers/draft";
import type { BriefProvider } from "@/lib/providers/types";
import type { Storage } from "@/lib/storage";
import { assembleBrief } from "./assemble";
import { DEFAULT_CACHE_TTL_SECONDS, diffNews, isCacheFresh, remapSourceIds, reprefixSources } from "./cache";
import { BriefError, toBriefError } from "./errors";
import { buildResearchQueries, companyCacheKey, normalizeCompanyName, type NormalizedCompany } from "./normalize";
import { planSections, type SectionPlan } from "./plan";
import type { CompanyBrief } from "./types";

export interface GenerateBriefOptions {
  provider: BriefProvider;
  /** When omitted, the pipeline runs exactly as before: no caching, always full research. */
  storage?: Storage;
  /** Bypass the cache regardless of TTL — the user-facing "force refresh" escape hatch. */
  forceRefresh?: boolean;
  cacheTtlSeconds?: number;
  /** Injected in tests so fixtures produce byte-stable briefs. */
  now?: () => Date;
}

/**
 * Generate a company preparation brief.
 *
 *   normalize -> cache lookup -> [hit: news-only research | miss: full research] ->
 *   plan sections -> structure -> assemble -> [miss: write cache]
 *
 * The plan step sits deliberately between the two provider calls: the model
 * classifies (or the cache already has a classification), our policy code
 * decides what that classification means, and the structuring call is told
 * which sections to produce. Section selection is never delegated to the model.
 */
export async function generateBrief(
  rawName: unknown,
  options: GenerateBriefOptions,
): Promise<CompanyBrief> {
  const {
    provider,
    storage,
    forceRefresh = false,
    cacheTtlSeconds = DEFAULT_CACHE_TTL_SECONDS,
    now = () => new Date(),
  } = options;

  // Throws invalid_input for empty or whitespace-only names, before any
  // provider call — an empty submission must never consume quota.
  const company = normalizeCompanyName(rawName);

  try {
    if (storage) {
      const hit = await tryCacheHit({
        company,
        provider,
        storage,
        forceRefresh,
        cacheTtlSeconds,
        now,
      });
      if (hit) return hit;
    }

    return await researchFullBrief({ company, provider, storage, now });
  } catch (error) {
    // Everything leaving the pipeline is a BriefError, so the route and the UI
    // have exactly one failure shape to handle.
    throw toBriefError(error);
  }
}

async function researchFullBrief(input: {
  company: NormalizedCompany;
  provider: BriefProvider;
  storage: Storage | undefined;
  now: () => Date;
}): Promise<CompanyBrief> {
  const { company, provider, storage, now } = input;

  const research = await provider.research({
    company,
    queries: buildResearchQueries(company),
  });

  if (research.noResults) {
    throw new BriefError(
      "no_results",
      "Research found no usable information about this company.",
    );
  }

  if (research.ambiguousCandidates && research.ambiguousCandidates.length > 1) {
    throw new BriefError(
      "ambiguous",
      "That name matches more than one company.",
      { candidates: research.ambiguousCandidates },
    );
  }

  const plan = planSections(research.classification);
  const draft = await provider.structure({ company, research, plan });
  const generatedAt = now().toISOString();

  const brief = assembleBrief({
    company,
    plan,
    draft,
    sources: research.sources,
    generatedAt,
  });

  if (storage) {
    await writeCache(storage, company, brief, generatedAt);
    return { ...brief, cache: { fromCache: false, cachedAt: generatedAt } };
  }

  return brief;
}

async function writeCache(
  storage: Storage,
  company: NormalizedCompany,
  brief: CompanyBrief,
  cachedAt: string,
): Promise<void> {
  const { sources: cachedSources, idMap } = reprefixSources(brief.sources, "c");
  const companyKey = companyCacheKey(company);

  await storage.putCompanyCache({
    companyKey,
    resolvedName: brief.resolvedName,
    overview: remapSourceIds(brief.overview, idMap),
    classification: brief.classification,
    deepDive: {
      ...brief.deepDive,
      topics: brief.deepDive.topics.map((topic) => remapSourceIds(topic, idMap)),
    },
    fourP: brief.fourP
      ? { entries: brief.fourP.entries.map((entry) => remapSourceIds(entry, idMap)) }
      : null,
    sources: cachedSources,
    cachedAt,
  });

  // Last-seen snapshot for the next repeat search's "what's changed" diff.
  await storage.putLastSeenNews(companyKey, brief.news.items, cachedAt);
}

async function tryCacheHit(input: {
  company: NormalizedCompany;
  provider: BriefProvider;
  storage: Storage;
  forceRefresh: boolean;
  cacheTtlSeconds: number;
  now: () => Date;
}): Promise<CompanyBrief | null> {
  const { company, provider, storage, forceRefresh, cacheTtlSeconds, now } = input;
  if (forceRefresh) return null;

  const companyKey = companyCacheKey(company);
  const cached = await storage.getCompanyCache(companyKey);
  if (!cached || !isCacheFresh(cached.cachedAt, cacheTtlSeconds, now())) return null;

  const plan: SectionPlan = planSections(cached.classification);

  const rawNewsResearch = await provider.researchNews({
    company,
    queries: buildResearchQueries(company),
  });
  const { sources: freshSources } = reprefixSources(rawNewsResearch.sources, "n");
  const newsResearch = { findings: rawNewsResearch.findings, sources: freshSources };

  const cacheDraft = await provider.structureFromCache({
    company,
    cached: {
      overview: cached.overview,
      classification: cached.classification,
      deepDive: cached.deepDive,
      fourP: cached.fourP,
      sources: cached.sources,
    },
    newsResearch,
    plan,
  });

  // The model was shown sources already under their final ids (`cached.sources`
  // carry `c...`, `freshSources` carry `n...`), so its citations need no
  // remapping here — unlike the fresh-research write path, which relabels
  // `s...` ids to `c...` only after the fact.
  const draft: BriefDraft = {
    resolvedName: cached.resolvedName,
    overview: cached.overview,
    classification: cached.classification,
    news: cacheDraft.news,
    deepDive: cached.deepDive,
    fourP: cached.fourP,
    talkingPoints: cacheDraft.talkingPoints,
    interviewerQuestions: cacheDraft.interviewerQuestions,
    unavailableNotes: cacheDraft.unavailableNotes,
  };

  const generatedAt = now().toISOString();
  const brief = assembleBrief({
    company,
    plan,
    draft,
    sources: [...cached.sources, ...freshSources],
    generatedAt,
  });

  const lastSeen = await storage.getLastSeenNews(companyKey);
  const newSinceLastSeen = diffNews(lastSeen?.items ?? [], brief.news.items);
  await storage.putLastSeenNews(companyKey, brief.news.items, generatedAt);

  return {
    ...brief,
    cache: { fromCache: true, cachedAt: cached.cachedAt, newSinceLastSeen },
  };
}
