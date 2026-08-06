import { BriefError } from "@/lib/brief/errors";
import { createFakeProvider } from "./fake";
import { createGeminiProvider } from "./gemini";
import type { BriefProvider } from "./types";

export type { BriefProvider } from "./types";

/**
 * Select the research provider from the environment.
 *
 * `BRIEF_PROVIDER=fake` runs the fixture-backed provider, which is how the app
 * is exercised locally without burning free-tier quota. Anything else requires
 * GEMINI_API_KEY. See docs/fallback-provider.md for adding an OpenRouter-backed
 * provider behind this same seam.
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): BriefProvider {
  if (env.BRIEF_PROVIDER === "fake") {
    return createFakeProvider({ fallbackToGeneric: true });
  }

  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new BriefError(
      "not_configured",
      "GEMINI_API_KEY is not set. Set it, or set BRIEF_PROVIDER=fake to use fixtures.",
    );
  }

  return createGeminiProvider({ apiKey, model: env.GEMINI_MODEL?.trim() });
}
