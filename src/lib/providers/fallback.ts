import { isBriefError } from "@/lib/brief/errors";
import type {
  BriefProvider,
  NewsResearchResult,
  ResearchRequest,
  ResearchResult,
  StructureFromCacheRequest,
  StructureRequest,
} from "./types";
import type { BriefDraft, CacheDraft } from "./draft";

/**
 * Error kinds worth retrying on a different provider: all of them are about
 * the provider failing to do its job, not about what the research turned up.
 * `invalid_input` / `no_results` / `ambiguous` are legitimate content-class
 * outcomes and are never retried — see
 * openspec/changes/add-openrouter-fallback-provider/design.md.
 */
const RETRYABLE_KINDS = new Set(["rate_limited", "provider_error", "not_configured", "malformed_response"]);

/**
 * Wrap a primary `BriefProvider` with automatic per-call fallback to a second
 * provider on infrastructure-class failure. Returns `primary` unchanged (no
 * wrapping at all) when `fallback` is null, so the fallback feature is purely
 * additive - a Gemini failure behaves exactly as it did before this wrapper
 * existed when no fallback is configured.
 *
 * Deliberately stateless: each of the four methods makes its own independent
 * try-primary-then-fallback decision, with no state shared across calls or
 * stored on the wrapper itself. `compareCompanies()` runs 2-3 `generateBrief`
 * calls concurrently against the same provider instance - any mutable
 * "which provider just ran" field here would race across those calls. See
 * design.md's rejected alternative for why this matters.
 */
export function withFallback(primary: BriefProvider, fallback: BriefProvider | null): BriefProvider {
  if (!fallback) return primary;

  async function attempt<T>(primaryCall: () => Promise<T>, fallbackCall: () => Promise<T>): Promise<T> {
    try {
      return await primaryCall();
    } catch (error) {
      if (isBriefError(error) && RETRYABLE_KINDS.has(error.kind)) {
        return await fallbackCall();
      }
      throw error;
    }
  }

  return {
    name: primary.name,

    research(request: ResearchRequest): Promise<ResearchResult> {
      return attempt(() => primary.research(request), () => fallback.research(request));
    },

    structure(request: StructureRequest): Promise<BriefDraft> {
      return attempt(() => primary.structure(request), () => fallback.structure(request));
    },

    researchNews(request: ResearchRequest): Promise<NewsResearchResult> {
      return attempt(() => primary.researchNews(request), () => fallback.researchNews(request));
    },

    structureFromCache(request: StructureFromCacheRequest): Promise<CacheDraft> {
      return attempt(() => primary.structureFromCache(request), () => fallback.structureFromCache(request));
    },
  };
}
