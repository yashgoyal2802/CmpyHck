import { findFixture, makeFixture, type BriefFixture } from "@/fixtures/briefs";
import { BriefError, type BriefErrorKind } from "@/lib/brief/errors";
import type { BriefDraft, CacheDraft } from "./draft";
import type {
  BriefProvider,
  NewsResearchResult,
  ResearchRequest,
  ResearchResult,
  StructureFromCacheRequest,
  StructureRequest,
} from "./types";

export interface FakeProviderOptions {
  /** Force a failure at the named stage — used to test error handling. */
  failWith?: {
    kind: BriefErrorKind;
    stage?: "research" | "structure" | "researchNews" | "structureFromCache";
  };
  /** Extra fixtures, keyed by lowercased company name. */
  fixtures?: Record<string, BriefFixture>;
  /** Return an unclassifiable fixture for unknown names instead of throwing. */
  fallbackToGeneric?: boolean;
}

/**
 * Fixture-backed provider used by tests and by local development without an
 * API key. It exercises the same two-stage seam as the real provider, so the
 * assembler and renderer are tested against the shape they see in production.
 */
export function createFakeProvider(
  options: FakeProviderOptions = {},
): BriefProvider {
  const { failWith, fixtures, fallbackToGeneric = false } = options;

  function resolve(name: string): BriefFixture {
    const fromExtra = fixtures?.[name.trim().toLowerCase()];
    if (fromExtra) return fromExtra;

    const fixture = findFixture(name);
    if (fixture) return fixture;

    if (fallbackToGeneric) {
      return makeFixture({ name, sector: "other", confidence: "uncertain" });
    }

    throw new BriefError(
      "no_results",
      `No fixture is registered for "${name}".`,
    );
  }

  function maybeFail(
    stage: "research" | "structure" | "researchNews" | "structureFromCache",
  ) {
    if (!failWith) return;
    if ((failWith.stage ?? "research") !== stage) return;
    throw new BriefError(failWith.kind, `Fake provider failure at ${stage}.`, {
      retryAfterSeconds: failWith.kind === "rate_limited" ? 30 : undefined,
    });
  }

  return {
    name: "fake",

    async research(request: ResearchRequest): Promise<ResearchResult> {
      maybeFail("research");
      return resolve(request.company.requestedName).research;
    },

    async structure(request: StructureRequest): Promise<BriefDraft> {
      maybeFail("structure");
      const fixture = resolve(request.company.requestedName);

      // Honour the plan the pipeline computed: a fixture carrying a framework
      // of the wrong kind must not smuggle it into a brief whose plan wanted
      // the other one.
      return {
        ...fixture.draft,
        framework: fixture.draft.framework?.kind === request.plan.framework ? fixture.draft.framework : null,
        deepDive: {
          ...fixture.draft.deepDive,
          heading: request.plan.deepDiveHeading,
        },
      };
    },

    async researchNews(request: ResearchRequest): Promise<NewsResearchResult> {
      maybeFail("researchNews");
      const fixture = resolve(request.company.requestedName);
      return {
        findings: fixture.research.findings,
        sources: fixture.research.sources,
        noResults: fixture.research.sources.length === 0,
      };
    },

    async structureFromCache(request: StructureFromCacheRequest): Promise<CacheDraft> {
      maybeFail("structureFromCache");
      const fixture = resolve(request.company.requestedName);
      return {
        news: fixture.draft.news,
        talkingPoints: fixture.draft.talkingPoints,
        interviewerQuestions: fixture.draft.interviewerQuestions,
        unavailableNotes: fixture.draft.unavailableNotes ?? [],
      };
    },
  };
}
