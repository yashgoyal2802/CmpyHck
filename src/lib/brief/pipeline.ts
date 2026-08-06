import type { BriefProvider } from "@/lib/providers/types";
import { assembleBrief } from "./assemble";
import { BriefError, toBriefError } from "./errors";
import { buildResearchQueries, normalizeCompanyName } from "./normalize";
import { planSections } from "./plan";
import type { CompanyBrief } from "./types";

export interface GenerateBriefOptions {
  provider: BriefProvider;
  /** Injected in tests so fixtures produce byte-stable briefs. */
  now?: () => Date;
}

/**
 * Generate a company preparation brief.
 *
 *   normalize -> research (grounded) -> plan sections -> structure -> assemble
 *
 * The plan step sits deliberately between the two provider calls: the model
 * classifies, our policy decides what that classification means, and the
 * structuring call is told which sections to produce. Section selection is
 * never delegated to the model.
 */
export async function generateBrief(
  rawName: unknown,
  options: GenerateBriefOptions,
): Promise<CompanyBrief> {
  const { provider, now = () => new Date() } = options;

  // Throws invalid_input for empty or whitespace-only names, before any
  // provider call — an empty submission must never consume quota.
  const company = normalizeCompanyName(rawName);

  try {
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

    return assembleBrief({
      company,
      plan,
      draft,
      sources: research.sources,
      generatedAt: now().toISOString(),
    });
  } catch (error) {
    // Everything leaving the pipeline is a BriefError, so the route and the UI
    // have exactly one failure shape to handle.
    throw toBriefError(error);
  }
}
