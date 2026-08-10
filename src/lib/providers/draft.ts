import { z } from "zod";
import {
  claimSchema,
  classificationSchema,
  deepDiveSchema,
  frameworkSchema,
  interviewerQuestionSchema,
  newsSectionSchema,
  talkingPointSchema,
} from "@/lib/brief/types";

/**
 * The slice of the brief a provider authors.
 *
 * Fields our own code owns are deliberately absent so a provider cannot
 * overwrite them: `requestedName` (what the user typed), `generatedAt`,
 * `sources` (mapped from grounding metadata, not model-authored), and the
 * deep dive's `sector` / `usedFallback` (decided by the SectionPlan).
 *
 * The pipeline merges this draft with those owned fields to produce a
 * CompanyBrief.
 */
export const briefDraftSchema = z.object({
  resolvedName: z.string(),
  overview: claimSchema,
  classification: classificationSchema,
  news: newsSectionSchema,
  deepDive: deepDiveSchema.omit({ sector: true, usedFallback: true }),
  /** Nullable: the provider may fail to produce the framework the plan asked for; assemble.ts enforces the "never neither" guarantee on the final brief. */
  framework: frameworkSchema.nullable(),
  talkingPoints: z.array(talkingPointSchema),
  interviewerQuestions: z.array(interviewerQuestionSchema),
  unavailableNotes: z.array(z.string()).default([]),
});

export type BriefDraft = z.infer<typeof briefDraftSchema>;

/**
 * The slice a provider authors on a cache hit: only the sections that must
 * always be fresh (news) and the syntheses over facts + news (talking
 * points, interviewer questions). Overview, classification, deep dive, and
 * 4P come from the cache untouched — the provider is not asked to reproduce
 * them.
 */
export const cacheDraftSchema = z.object({
  news: newsSectionSchema,
  talkingPoints: z.array(talkingPointSchema),
  interviewerQuestions: z.array(interviewerQuestionSchema),
  unavailableNotes: z.array(z.string()).default([]),
});

export type CacheDraft = z.infer<typeof cacheDraftSchema>;
