import { describe, expect, it } from "vitest";
import { getProvider, getProviderForApiKey } from "@/lib/providers";

const env = (overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv =>
  ({ NODE_ENV: "test", ...overrides }) as NodeJS.ProcessEnv;

describe("provider selection (add-per-session-gemini-key task 6.5)", () => {
  it("getProvider uses the fake provider when BRIEF_PROVIDER=fake, regardless of GEMINI_API_KEY", () => {
    const provider = getProvider(env({ BRIEF_PROVIDER: "fake" }));
    expect(provider.name).toBe("fake");
  });

  it("getProvider's calls throw not_configured when no GEMINI_API_KEY is set", async () => {
    // Construction itself no longer throws (add-openrouter-fallback-provider):
    // the failure is deferred to call time so a configured fallback gets a
    // chance to run instead of GEMINI_API_KEY being a special unrecoverable case.
    const provider = getProvider(env({}));
    await expect(provider.research({ company: {} as never, queries: [] })).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it("getProvider builds a gemini provider from the env key", () => {
    const provider = getProvider(env({ GEMINI_API_KEY: "env-key" }));
    expect(provider.name).toBe("gemini");
  });

  it("getProviderForApiKey builds a gemini provider from an explicit key, independent of env", () => {
    // No GEMINI_API_KEY in this env at all - a non-admin session's own key
    // must be sufficient on its own, never falling back to the server's.
    const provider = getProviderForApiKey("session-supplied-key", env({}));
    expect(provider.name).toBe("gemini");
  });
});
