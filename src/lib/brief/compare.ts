import type { BriefProvider } from "@/lib/providers/types";
import type { Storage } from "@/lib/storage";
import { toBriefError } from "./errors";
import { generateBrief } from "./pipeline";
import type { CompanyBrief } from "./types";

export const MIN_COMPARISON_COMPANIES = 2;
export const MAX_COMPARISON_COMPANIES = 3;

export interface ComparisonResult {
  companyName: string;
  brief?: CompanyBrief;
  error?: { kind: string; message: string };
}

export class InvalidComparisonError extends Error {
  constructor(count: number) {
    super(
      `Comparison requires ${MIN_COMPARISON_COMPANIES}-${MAX_COMPARISON_COMPANIES} companies, got ${count}.`,
    );
    this.name = "InvalidComparisonError";
  }
}

/**
 * Generate briefs for 2-3 companies independently, reusing the cache exactly
 * as a standalone search would. One company failing to research never blocks
 * the others — each result carries either a brief or an error.
 */
export async function compareCompanies(
  companyNames: string[],
  options: { provider: BriefProvider; storage?: Storage },
): Promise<ComparisonResult[]> {
  if (
    companyNames.length < MIN_COMPARISON_COMPANIES ||
    companyNames.length > MAX_COMPARISON_COMPANIES
  ) {
    throw new InvalidComparisonError(companyNames.length);
  }

  const settled = await Promise.allSettled(
    companyNames.map((name) => generateBrief(name, options)),
  );

  return settled.map((outcome, index) => {
    const companyName = companyNames[index];
    if (outcome.status === "fulfilled") return { companyName, brief: outcome.value };

    const briefError = toBriefError(outcome.reason);
    return {
      companyName,
      error: { kind: briefError.kind, message: briefError.message },
    };
  });
}
