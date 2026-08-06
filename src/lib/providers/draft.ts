import { z } from "zod";
import {
  claimSchema,
  classificationSchema,
  deepDiveSchema,
  fourPSectionSchema,
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
  fourP: fourPSectionSchema.nullable(),
  talkingPoints: z.array(talkingPointSchema),
  interviewerQuestions: z.array(interviewerQuestionSchema),
  unavailableNotes: z.array(z.string()).default([]),
});

export type BriefDraft = z.infer<typeof briefDraftSchema>;
