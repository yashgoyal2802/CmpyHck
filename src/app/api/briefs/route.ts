import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/auth/server";
import { BriefError, HTTP_STATUS, USER_MESSAGE, toBriefError } from "@/lib/brief/errors";
import { generateBrief } from "@/lib/brief/pipeline";
import { getProvider, getProviderForApiKey } from "@/lib/providers";
import { createFakeProvider } from "@/lib/providers/fake";
import { getStorage } from "@/lib/storage";

/** Grounded research is slow; give it room before the platform cuts us off. */
export const maxDuration = 120;

export async function POST(request: Request) {
  // Middleware already gates this route. Re-checking here is defence in depth:
  // this handler burns research quota, so it should never rely on a single gate.
  const session = await getSessionAccount();
  if (!session) {
    return NextResponse.json(
      {
        error: {
          kind: "unauthorized",
          message: "Sign in to generate briefs.",
        },
      },
      { status: 401 },
    );
  }

  let companyName: unknown;
  let forceRefresh = false;
  try {
    const body = await request.json();
    companyName = (body as { companyName?: unknown })?.companyName;
    forceRefresh = Boolean((body as { forceRefresh?: unknown })?.forceRefresh);
  } catch {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: USER_MESSAGE.invalid_input } },
      { status: 400 },
    );
  }

  try {
    // A demo session never calls a real provider and never touches the
    // database - fixture-backed only, and `storage` is omitted entirely
    // (generateBrief runs with no caching at all when it's absent) so a
    // demo search can never read or write the real shared company cache.
    // fallbackToGeneric is explicitly false: an unrecognized name must
    // surface the real no_results outcome, not a fabricated generic brief -
    // see add-demo-mode design.md (the BRIEF_PROVIDER=fake dev path uses
    // fallbackToGeneric: true, which would be wrong here).
    if (session.isDemo) {
      const brief = await generateBrief(companyName, {
        provider: createFakeProvider({ fallbackToGeneric: false }),
        forceRefresh,
      });
      return NextResponse.json({ brief });
    }

    // Admin uses the server's own key; every other role supplied its own at
    // login (middleware already refuses a non-admin session with no key, so
    // this is a defensive-depth check, not the primary enforcement point).
    if (session.role !== "admin" && !session.apiKey) {
      throw new BriefError(
        "not_configured",
        "Your session has no Gemini API key. Sign in again to provide one.",
      );
    }
    const provider = session.role === "admin" ? getProvider() : getProviderForApiKey(session.apiKey!);

    const ttlEnv = Number(process.env.CACHE_TTL_SECONDS);
    const brief = await generateBrief(companyName, {
      provider,
      storage: getStorage(),
      forceRefresh,
      ...(Number.isFinite(ttlEnv) && ttlEnv > 0 ? { cacheTtlSeconds: ttlEnv } : {}),
    });
    return NextResponse.json({ brief });
  } catch (error) {
    const briefError = toBriefError(error);

    // Server-side detail for debugging; the client only sees USER_MESSAGE.
    console.error(
      `[briefs] ${briefError.kind}: ${briefError.message}`,
      briefError.cause ?? "",
    );

    return NextResponse.json(
      {
        error: {
          kind: briefError.kind,
          message: USER_MESSAGE[briefError.kind],
          retryable: briefError.retryable,
          retryAfterSeconds: briefError.retryAfterSeconds,
          candidates: briefError.candidates,
        },
      },
      { status: HTTP_STATUS[briefError.kind] },
    );
  }
}
