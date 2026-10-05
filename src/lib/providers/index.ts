import { BriefError } from "@/lib/brief/errors";
import { createFakeProvider } from "./fake";
import { withFallback } from "./fallback";
import { createGeminiProvider } from "./gemini";
import { createOpenRouterProvider } from "./openrouter";
import type { BriefProvider } from "./types";

export type { BriefProvider } from "./types";

/**
 * Select the research provider from the environment.
 *
 * `BRIEF_PROVIDER=fake` runs the fixture-backed provider, which is how the app
 * is exercised locally without burning free-tier quota. Anything else requires
 * GEMINI_API_KEY. See docs/fallback-provider.md and
 * add-openrouter-fallback-provider for the OpenRouter-backed fallback wrapped
 * around this.
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): BriefProvider {
  if (env.BRIEF_PROVIDER === "fake") {
    return createFakeProvider({ fallbackToGeneric: true });
  }

  const apiKey = env.GEMINI_API_KEY?.trim();
  const primary = apiKey
    ? createGeminiProvider({ apiKey, model: env.GEMINI_MODEL?.trim() })
    : createUnconfiguredProvider(
        "GEMINI_API_KEY is not set. Set it, or set BRIEF_PROVIDER=fake to use fixtures.",
      );

  return withFallback(primary, getFallbackProvider(env));
}

/**
 * Build a provider from an explicit API key rather than the environment.
 *
 * Used for non-admin sessions, which supply their own Gemini key at login
 * instead of sharing the server's `GEMINI_API_KEY` - see
 * add-per-session-gemini-key. `getProvider` above is unchanged and still
 * backs the admin/env-key path.
 */
export function getProviderForApiKey(
  apiKey: string,
  env: NodeJS.ProcessEnv = process.env,
): BriefProvider {
  const primary = createGeminiProvider({ apiKey, model: env.GEMINI_MODEL?.trim() });
  return withFallback(primary, getFallbackProvider(env));
}

/**
 * A provider whose every method throws `not_configured` when actually
 * called, rather than `getProvider` throwing synchronously before a fallback
 * ever gets a chance to run. `not_configured` is in the fallback's retryable
 * set, so a missing `GEMINI_API_KEY` degrades to the fallback (when one is
 * configured) exactly like any other infrastructure-class Gemini failure,
 * rather than being a special case that can never recover.
 */
function createUnconfiguredProvider(message: string): BriefProvider {
  const fail = async (): Promise<never> => {
    throw new BriefError("not_configured", message);
  };
  return { name: "unconfigured", research: fail, structure: fail, researchNews: fail, structureFromCache: fail };
}

/**
 * The shared, app-owned fallback provider - independent of which Gemini key
 * backed the primary attempt (env key or a non-admin session's own key), so
 * a non-admin account never needs its own OpenRouter/Tavily credentials.
 * Returns null (no fallback) when any of the three env vars is unset - the
 * fallback is optional infrastructure, not a requirement to run the app.
 */
function getFallbackProvider(env: NodeJS.ProcessEnv): BriefProvider | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim();
  const tavilyApiKey = env.TAVILY_API_KEY?.trim();
  if (!apiKey || !model || !tavilyApiKey) return null;

  return createOpenRouterProvider({ apiKey, model, tavilyApiKey });
}
