import {
  SECTOR_POLICY,
  fourPApplies,
  type Sector,
} from "./sectors";
import {
  INTERVIEWER_QUESTION_COUNT,
  NEWS_MAX,
  NEWS_MIN,
  TALKING_POINT_COUNT,
  type Classification,
} from "./types";

/**
 * Which sections this brief will contain, and with what shape.
 *
 * Computed by us from the classification — never by the model. The model
 * classifies; policy decides what that classification means. That keeps
 * "no 4P for BFSI" a property of the code rather than a hope about a prompt.
 */
export interface SectionPlan {
  sector: Sector;
  sectorLabel: string;
  deepDiveHeading: string;
  themes: string[];
  /** Every brief gets exactly one: 4P where marketing framing drives the interview, Five Forces otherwise. */
  framework: "four_p" | "five_forces";
  /** Classification was uncertain; the general deep dive is used instead. */
  usedFallback: boolean;
  newsMin: number;
  newsMax: number;
  talkingPointCount: number;
  interviewerQuestionCount: number;
}

export function planSections(classification: Classification): SectionPlan {
  // An uncertain classification falls back to the general deep dive rather than
  // asserting sector-specific themes the evidence does not support.
  const usedFallback = classification.confidence === "uncertain";
  const effectiveSector: Sector = usedFallback ? "other" : classification.sector;
  const policy = SECTOR_POLICY[effectiveSector];

  return {
    sector: effectiveSector,
    sectorLabel: policy.label,
    deepDiveHeading: policy.deepDiveHeading,
    themes: policy.themes,
    framework: fourPApplies(effectiveSector, classification.marketingRelevant) ? "four_p" : "five_forces",
    usedFallback,
    newsMin: NEWS_MIN,
    newsMax: NEWS_MAX,
    talkingPointCount: TALKING_POINT_COUNT,
    interviewerQuestionCount: INTERVIEWER_QUESTION_COUNT,
  };
}
