import type { BriefDraft } from "@/lib/providers/draft";
import { companyCacheKey, type NormalizedCompany } from "./normalize";
import type { SectionPlan } from "./plan";
import {
  companyBriefSchema,
  FIVE_FORCES,
  FOUR_P_DIMENSIONS,
  type Claim,
  type CompanyBrief,
  type Framework,
  type SourceRef,
  type TalkingPoint,
} from "./types";

export interface AssembleInput {
  company: NormalizedCompany;
  plan: SectionPlan;
  draft: BriefDraft;
  sources: SourceRef[];
  generatedAt?: string;
}

/**
 * Merge a provider draft with the fields our code owns, and enforce the rules
 * the spec makes non-negotiable.
 *
 * Enforcement, not trust: the prompt asks for these properties, and this
 * function guarantees them. Where the two disagree the code wins, because a
 * prompt is a request and this is the contract the UI renders against.
 *
 * Every correction is recorded in `unavailableNotes` rather than applied
 * silently — the reader should be able to see where the brief fell short.
 */
export function assembleBrief(input: AssembleInput): CompanyBrief {
  const { company, plan, draft, sources } = input;
  const notes = [...(draft.unavailableNotes ?? [])];
  const validIds = new Set(sources.map((s) => s.id));

  // --- Source integrity -----------------------------------------------------
  // A claim marked "sourced" that cites nothing real is the exact fabrication
  // this brief exists to avoid. Downgrade it to "inferred" so the reader is not
  // told a fact is backed when it is not.
  const overview = enforceBasis(draft.overview, validIds);

  const news = {
    items: draft.news.items
      .slice(0, plan.newsMax)
      .map((item) => ({ ...item, sourceIds: keepValid(item.sourceIds, validIds) })),
    unavailable: draft.news.unavailable,
  };

  if (news.items.length === 0 && !news.unavailable) {
    news.unavailable = "No recent relevant news was found for this company.";
  }
  if (news.items.length > 0 && news.items.length < plan.newsMin) {
    notes.push(
      `Only ${news.items.length} placement-relevant news item${
        news.items.length === 1 ? "" : "s"
      } could be established (target is ${plan.newsMin}–${plan.newsMax}).`,
    );
  }

  const deepDiveTopics = draft.deepDive.topics.map((topic) => {
    const checked = enforceBasis(
      { body: topic.body, basis: topic.basis, sourceIds: topic.sourceIds },
      validIds,
    );
    return {
      heading: topic.heading,
      body: topic.body,
      basis: checked.basis,
      sourceIds: checked.sourceIds,
    };
  });

  const deepDive = {
    // Sector and fallback are the plan's to decide, never the model's.
    sector: plan.sector,
    usedFallback: plan.usedFallback,
    heading: plan.deepDiveHeading,
    topics: deepDiveTopics,
    unavailable:
      draft.deepDive.unavailable ??
      (deepDiveTopics.length === 0
        ? "Reliable evidence for the sector deep dive could not be established."
        : undefined),
  };

  // --- Strategic framework ---------------------------------------------------
  // The plan decides which framework (4P or Five Forces) this brief gets — never
  // both, never neither. A draft that returned the wrong kind (or none at all)
  // for what the plan wanted falls back to a labelled "not established"
  // placeholder rather than the brief silently omitting the section.
  const framework = buildFramework(plan.framework, draft.framework, validIds, notes);

  // --- Fixed counts ---------------------------------------------------------
  // Trim overruns; never pad a shortfall, because padding means fabricating.
  const talkingPoints: TalkingPoint[] = draft.talkingPoints
    .slice(0, plan.talkingPointCount)
    .map((point) => {
      const checked = enforceBasis(
        { body: point.point, basis: point.basis, sourceIds: point.sourceIds },
        validIds,
      );
      return {
        point: point.point,
        basis: checked.basis,
        sourceIds: checked.sourceIds,
      };
    });
  if (talkingPoints.length < plan.talkingPointCount) {
    notes.push(
      `Only ${talkingPoints.length} of ${plan.talkingPointCount} talking points could be generated.`,
    );
  }

  const interviewerQuestions = draft.interviewerQuestions.slice(
    0,
    plan.interviewerQuestionCount,
  );
  if (interviewerQuestions.length < plan.interviewerQuestionCount) {
    notes.push(
      `Only ${interviewerQuestions.length} of ${plan.interviewerQuestionCount} interviewer questions could be generated.`,
    );
  }

  if (deepDive.unavailable && !notes.includes(deepDive.unavailable)) {
    notes.push(deepDive.unavailable);
  }

  const brief: CompanyBrief = {
    requestedName: company.requestedName,
    resolvedName: draft.resolvedName || company.requestedName,
    companyKey: companyCacheKey(company),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    overview,
    classification: { ...draft.classification, sector: plan.sector },
    news,
    deepDive,
    framework,
    talkingPoints,
    interviewerQuestions,
    sources,
    unavailableNotes: dedupe(notes),
  };

  // Final gate: what the UI renders is always schema-valid.
  return companyBriefSchema.parse(brief);
}

/**
 * Most citations a single claim may carry.
 *
 * The prompt asks for restraint; live runs showed claims arriving with ten
 * source ids attached. A citation the reader cannot act on is not a citation:
 * the point is to open one link and check the claim, and a ten-item list
 * defeats that. Enforced here rather than hoped for in the prompt.
 */
export const MAX_CITATIONS_PER_CLAIM = 3;

/**
 * Drop citations that do not resolve to a real source in this brief, and cap
 * the rest. Order is preserved, so the model's own ranking decides which
 * citations survive.
 */
function keepValid(ids: string[] | undefined, validIds: Set<string>): string[] {
  const resolved = (ids ?? []).filter((id) => validIds.has(id));
  return [...new Set(resolved)].slice(0, MAX_CITATIONS_PER_CLAIM);
}

/**
 * Build the one strategic framework a brief carries. If the draft provided
 * the kind the plan asked for, its entries are enforced through the same
 * sourced/inferred discipline as every other claim. If it didn't (wrong kind
 * or missing entirely), a labelled placeholder stands in — the "SHALL NOT
 * omit a framework entirely" requirement is a schema-level guarantee, not a
 * best-effort one.
 */
function buildFramework(
  wanted: SectionPlan["framework"],
  provided: BriefDraft["framework"],
  validIds: Set<string>,
  notes: string[],
): Framework {
  if (wanted === "four_p") {
    if (provided?.kind === "four_p") {
      return { kind: "four_p", entries: provided.entries.map((entry) => enforceEntryBasis(entry, validIds)) };
    }
    notes.push("4P analysis applies to this sector but could not be generated.");
    return {
      kind: "four_p",
      entries: FOUR_P_DIMENSIONS.map((dimension) => ({
        dimension,
        body: "Not established.",
        basis: "inferred" as const,
        sourceIds: [],
      })),
    };
  }

  if (provided?.kind === "five_forces") {
    return { kind: "five_forces", entries: provided.entries.map((entry) => enforceEntryBasis(entry, validIds)) };
  }
  notes.push("Five Forces analysis could not be generated.");
  return {
    kind: "five_forces",
    entries: FIVE_FORCES.map((dimension) => ({
      dimension,
      body: "Not established.",
      basis: "inferred" as const,
      sourceIds: [],
    })),
  };
}

function enforceEntryBasis<T extends { body: string; basis: Claim["basis"]; sourceIds: string[] }>(
  entry: T,
  validIds: Set<string>,
): T {
  const checked = enforceBasis({ body: entry.body, basis: entry.basis, sourceIds: entry.sourceIds }, validIds);
  return { ...entry, basis: checked.basis, sourceIds: checked.sourceIds };
}

/**
 * Keep `basis` honest: "sourced" survives only if at least one citation
 * resolves. Otherwise the claim is analysis, and is labelled as such.
 */
function enforceBasis(claim: Claim, validIds: Set<string>): Claim {
  const sourceIds = keepValid(claim.sourceIds, validIds);
  if (claim.basis === "sourced" && sourceIds.length === 0) {
    return { body: claim.body, basis: "inferred", sourceIds: [] };
  }
  return { body: claim.body, basis: claim.basis, sourceIds };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim().length > 0))];
}
