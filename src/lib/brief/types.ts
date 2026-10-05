import { z } from "zod";
import { SECTORS } from "./sectors";

/**
 * Structured company preparation brief.
 *
 * The zod schemas here are the single source of truth: they validate model
 * output at the provider boundary AND derive the TypeScript types used by the
 * pipeline and the UI, so the two cannot drift.
 *
 * Source transparency is enforced structurally rather than by convention:
 * every claim-bearing block carries a `basis` discriminating a sourced fact
 * from generated analysis, plus the `sourceIds` backing it.
 */

/** Whether a statement rests on retrieved evidence or on the model's analysis. */
export const basisSchema = z.enum(["sourced", "inferred"]);
export type Basis = z.infer<typeof basisSchema>;

/** Which provider actually produced a brief's structuring stage — see add-openrouter-fallback-provider. */
export const providerUsedSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
});
export type ProviderUsed = z.infer<typeof providerUsedSchema>;

export const sourceRefSchema = z.object({
  /** Stable within one brief, e.g. "s1" — referenced by `sourceIds`. */
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().optional(),
  /** Publisher or domain, shown when the raw URL is unhelpful. */
  sourceLabel: z.string().min(1),
  /** Publication date when the provider surfaced one. */
  date: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

/** A block of prose whose epistemic status is explicit. */
export const claimSchema = z.object({
  body: z.string().min(1),
  basis: basisSchema,
  sourceIds: z.array(z.string()).default([]),
});
export type Claim = z.infer<typeof claimSchema>;

export const classificationSchema = z.object({
  sector: z.enum(SECTORS),
  /** `uncertain` renders as a hedged "likely" label and permits the general fallback. */
  confidence: z.enum(["likely", "uncertain"]),
  rationale: z.string().min(1),
  /**
   * Does marketing framing drive this company's interviews? Only consulted for
   * sectors whose 4P policy is `byRoleRelevance`.
   */
  marketingRelevant: z.boolean(),
});
export type Classification = z.infer<typeof classificationSchema>;

export const newsItemSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Why a placement candidate should care — the whole point of the section. */
  whyItMatters: z.string().min(1),
  date: z.string().optional(),
  sourceIds: z.array(z.string()).default([]),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

export const newsSectionSchema = z.object({
  items: z.array(newsItemSchema),
  /** Set when no relevant recent news was found; items must then be empty. */
  unavailable: z.string().optional(),
});
export type NewsSection = z.infer<typeof newsSectionSchema>;

export const deepDiveTopicSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  basis: basisSchema,
  sourceIds: z.array(z.string()).default([]),
});
export type DeepDiveTopic = z.infer<typeof deepDiveTopicSchema>;

export const deepDiveSchema = z.object({
  sector: z.enum(SECTORS),
  heading: z.string().min(1),
  /** True when classification was uncertain and the general deep dive was used. */
  usedFallback: z.boolean().default(false),
  topics: z.array(deepDiveTopicSchema),
  /** Set when reliable evidence could not be established. */
  unavailable: z.string().optional(),
});
export type DeepDive = z.infer<typeof deepDiveSchema>;

export const FOUR_P_DIMENSIONS = ["Product", "Price", "Place", "Promotion"] as const;

export const fourPEntrySchema = z.object({
  dimension: z.enum(FOUR_P_DIMENSIONS),
  body: z.string().min(1),
  basis: basisSchema,
  sourceIds: z.array(z.string()).default([]),
});
export type FourPEntry = z.infer<typeof fourPEntrySchema>;

export const fourPSectionSchema = z.object({
  entries: z.array(fourPEntrySchema).length(4),
});
export type FourPSection = z.infer<typeof fourPSectionSchema>;

export const FIVE_FORCES = [
  "Competitive Rivalry",
  "Supplier Power",
  "Buyer Power",
  "Threat of Substitutes",
  "Threat of New Entrants",
] as const;

export const fiveForcesEntrySchema = z.object({
  dimension: z.enum(FIVE_FORCES),
  body: z.string().min(1),
  basis: basisSchema,
  sourceIds: z.array(z.string()).default([]),
});
export type FiveForcesEntry = z.infer<typeof fiveForcesEntrySchema>;

export const fiveForcesSectionSchema = z.object({
  entries: z.array(fiveForcesEntrySchema).length(5),
});
export type FiveForcesSection = z.infer<typeof fiveForcesSectionSchema>;

/**
 * Every brief carries exactly one strategic framework: 4P for sectors where
 * marketing framing drives the interview, Five Forces everywhere else (see
 * `fourPApplies` in ./sectors). `kind` discriminates which one a given brief
 * has — never both, never neither.
 */
export const frameworkSchema = z.discriminatedUnion("kind", [
  fourPSectionSchema.extend({ kind: z.literal("four_p") }),
  fiveForcesSectionSchema.extend({ kind: z.literal("five_forces") }),
]);
export type Framework = z.infer<typeof frameworkSchema>;

export const talkingPointSchema = z.object({
  point: z.string().min(1),
  basis: basisSchema,
  sourceIds: z.array(z.string()).default([]),
});
export type TalkingPoint = z.infer<typeof talkingPointSchema>;

export const interviewerQuestionSchema = z.object({
  question: z.string().min(1),
  /** Why this question lands — helps the student deliver it, not just read it. */
  rationale: z.string().min(1),
});
export type InterviewerQuestion = z.infer<typeof interviewerQuestionSchema>;

export const TALKING_POINT_COUNT = 5;
export const INTERVIEWER_QUESTION_COUNT = 3;
export const NEWS_MIN = 3;
export const NEWS_MAX = 5;

/** Present only when the brief was served (wholly or partly) from the shared cache. */
export const cacheInfoSchema = z.object({
  fromCache: z.boolean(),
  cachedAt: z.string(),
  /** Set on a cache hit: news new since the last time this company was searched, empty if none. */
  newSinceLastSeen: z.array(newsItemSchema).optional(),
});
export type CacheInfo = z.infer<typeof cacheInfoSchema>;

export const companyBriefSchema = z.object({
  /** Exactly what the user typed. */
  requestedName: z.string().min(1),
  /** Canonical company name the research resolved to. */
  resolvedName: z.string().min(1),
  /** Cache/organizer key for this company — stable across repeat searches of the same company. */
  companyKey: z.string().min(1),
  generatedAt: z.string(),
  overview: claimSchema,
  classification: classificationSchema,
  news: newsSectionSchema,
  deepDive: deepDiveSchema,
  /** Never null — every brief has exactly one strategic framework. */
  framework: frameworkSchema,
  talkingPoints: z.array(talkingPointSchema),
  interviewerQuestions: z.array(interviewerQuestionSchema),
  sources: z.array(sourceRefSchema),
  /** Human-readable notes about what could not be established. */
  unavailableNotes: z.array(z.string()).default([]),
  /** Absent when generated without a storage layer (e.g. tests calling the pipeline directly). */
  cache: cacheInfoSchema.optional(),
  /** Which provider produced this brief's structuring stage. Absent for briefs generated before this field existed. */
  providerUsed: providerUsedSchema.optional(),
});
export type CompanyBrief = z.infer<typeof companyBriefSchema>;
