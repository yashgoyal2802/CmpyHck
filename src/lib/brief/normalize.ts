import { BriefError } from "./errors";

/** Upper bound on a company name; anything longer is a paste, not a name. */
export const MAX_COMPANY_NAME_LENGTH = 120;

/**
 * Legal-form suffixes stripped when building search queries. Kept out of the
 * display name — "Hindustan Unilever" searches better than "Hindustan Unilever
 * Limited", but the user should still see what they typed.
 */
const LEGAL_SUFFIXES = [
  "private limited",
  "pvt limited",
  "pvt ltd",
  "pvt. ltd.",
  "limited",
  "ltd",
  "ltd.",
  "llp",
  "inc",
  "inc.",
  "incorporated",
  "corporation",
  "corp",
  "corp.",
  "company",
  "co.",
  "plc",
  "gmbh",
  "s.a.",
  "n.v.",
];

export interface NormalizedCompany {
  /** Exactly what the user typed, trimmed. Shown back to them. */
  requestedName: string;
  /** Whitespace- and case-normalized form used for search. */
  searchName: string;
  /** `searchName` with legal-form suffixes removed. */
  coreName: string;
}

/**
 * Validate and normalize a submitted company name.
 *
 * @throws BriefError with kind `invalid_input` when empty or whitespace-only.
 */
export function normalizeCompanyName(raw: unknown): NormalizedCompany {
  if (typeof raw !== "string") {
    throw new BriefError("invalid_input", "Company name must be text.");
  }

  const requestedName = collapseWhitespace(raw);
  if (requestedName.length === 0) {
    throw new BriefError("invalid_input", "Company name is required.");
  }
  if (requestedName.length > MAX_COMPANY_NAME_LENGTH) {
    throw new BriefError(
      "invalid_input",
      `Company name must be ${MAX_COMPANY_NAME_LENGTH} characters or fewer.`,
    );
  }

  const searchName = requestedName;
  return { requestedName, searchName, coreName: stripLegalSuffix(searchName) };
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripLegalSuffix(name: string): string {
  let result = name.trim();
  // Loop: "Foo Pvt Ltd" carries two suffixes and both should come off.
  let changed = true;
  while (changed) {
    changed = false;
    const lower = result.toLowerCase();
    for (const suffix of LEGAL_SUFFIXES) {
      if (lower.endsWith(" " + suffix)) {
        result = result.slice(0, result.length - suffix.length - 1).trim();
        // Trailing comma from "Foo, Inc." style names.
        result = result.replace(/[,]+$/, "").trim();
        changed = true;
        break;
      }
    }
  }
  return result.length > 0 ? result : name;
}

/**
 * Search queries for the research stage.
 *
 * Placement usefulness is steered by the prompt, but the queries themselves
 * bias toward the signals that matter: strategy, deals, results, hiring —
 * rather than a bare company-name lookup that returns homepage boilerplate.
 */
export function buildResearchQueries(company: NormalizedCompany): string[] {
  const name = company.coreName;
  return [
    `${name} company overview business model`,
    `${name} latest news strategy announcement`,
    `${name} results revenue growth quarter`,
    `${name} deal partnership expansion launch`,
    `${name} hiring campus recruitment graduate programme`,
  ];
}
