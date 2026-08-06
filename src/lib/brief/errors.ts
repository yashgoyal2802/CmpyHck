/**
 * Failure modes the brief pipeline distinguishes.
 *
 * These exist so the UI can say what actually went wrong and offer the right
 * next step. The spec's controlling rule: when research cannot be completed we
 * report that, we never return a brief assembled without evidence.
 */
export type BriefErrorKind =
  | "invalid_input"
  /** Provider quota or per-minute limit hit — retrying later will work. */
  | "rate_limited"
  /** Provider returned an error, timed out, or was unreachable. */
  | "provider_error"
  /** Research ran but found nothing usable about this company. */
  | "no_results"
  /** Research matched several distinct companies; the user should disambiguate. */
  | "ambiguous"
  /** Provider replied but the payload did not match the brief schema. */
  | "malformed_response"
  | "not_configured";

export class BriefError extends Error {
  readonly kind: BriefErrorKind;
  /** Whether the same request is worth retrying unchanged. */
  readonly retryable: boolean;
  /** Seconds to wait before retrying, when the provider tells us. */
  readonly retryAfterSeconds?: number;
  /** Alternative company names, when the request was ambiguous. */
  readonly candidates?: string[];

  constructor(
    kind: BriefErrorKind,
    message: string,
    options: {
      retryable?: boolean;
      retryAfterSeconds?: number;
      candidates?: string[];
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "BriefError";
    this.kind = kind;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[kind];
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.candidates = options.candidates;
  }
}

const DEFAULT_RETRYABLE: Record<BriefErrorKind, boolean> = {
  invalid_input: false,
  rate_limited: true,
  provider_error: true,
  no_results: false,
  ambiguous: false,
  malformed_response: true,
  not_configured: false,
};

/** HTTP status the API route returns for each failure mode. */
export const HTTP_STATUS: Record<BriefErrorKind, number> = {
  invalid_input: 400,
  rate_limited: 429,
  provider_error: 502,
  no_results: 404,
  ambiguous: 409,
  malformed_response: 502,
  not_configured: 500,
};

/** Message shown to the user. Never leaks provider internals. */
export const USER_MESSAGE: Record<BriefErrorKind, string> = {
  invalid_input: "Please enter a company name.",
  rate_limited:
    "The research provider is rate limited right now. Wait a moment and try again.",
  provider_error:
    "Research could not be completed because the provider failed. Try again in a moment.",
  no_results:
    "No usable public information was found for that company. Check the spelling, or try the company's full registered name.",
  ambiguous:
    "That name matches more than one company. Try a more specific name.",
  malformed_response:
    "Research completed but the result could not be read. Try again.",
  not_configured:
    "The research provider is not configured. Set GEMINI_API_KEY and restart.",
};

export function isBriefError(error: unknown): error is BriefError {
  return error instanceof BriefError;
}

/** Normalize any thrown value into a BriefError so callers have one shape. */
export function toBriefError(error: unknown): BriefError {
  if (isBriefError(error)) return error;
  return new BriefError("provider_error", "Unexpected research failure.", {
    cause: error,
  });
}
