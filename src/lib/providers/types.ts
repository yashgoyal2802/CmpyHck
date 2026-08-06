import type { NormalizedCompany } from "@/lib/brief/normalize";
import type { SectionPlan } from "@/lib/brief/plan";
import type { Classification, SourceRef } from "@/lib/brief/types";
import type { BriefDraft } from "./draft";

/**
 * The provider seam.
 *
 * Two stages rather than one, for two independent reasons:
 *
 *  1. Gemini cannot combine Google Search grounding with a response schema in a
 *     single call — grounded research and schema-constrained structuring have to
 *     be separate requests regardless of how we'd prefer to model it.
 *  2. It gives us a place to stand between the two: the classification comes back
 *     from stage one, our own policy code turns it into a SectionPlan, and stage
 *     two is told exactly which sections to produce. Section selection is
 *     therefore enforced by us, not delegated to the model.
 *
 * The seam exists so the documented OpenRouter + standalone-search fallback can
 * be adopted without touching the pipeline, the schema, or the UI. See
 * docs/fallback-provider.md.
 */
export interface BriefProvider {
  readonly name: string;

  /** Stage one: search the live web and return grounded findings with sources. */
  research(request: ResearchRequest): Promise<ResearchResult>;

  /**
   * Stage two: turn findings into the schema-valid brief slice the provider
   * authors. The pipeline merges this with the fields our code owns.
   */
  structure(request: StructureRequest): Promise<BriefDraft>;
}

export interface ResearchRequest {
  company: NormalizedCompany;
  /** Query hints; a grounded provider may issue its own searches too. */
  queries: string[];
}

export interface ResearchResult {
  /** Canonical company name the research settled on. */
  resolvedName: string;
  classification: Classification;
  /** Grounded prose findings, carrying inline [s1] style source markers. */
  findings: string;
  sources: SourceRef[];
  /** Populated when the name matched several distinct companies. */
  ambiguousCandidates?: string[];
  /** True when search returned nothing usable about this company. */
  noResults?: boolean;
}

export interface StructureRequest {
  company: NormalizedCompany;
  research: ResearchResult;
  plan: SectionPlan;
}
