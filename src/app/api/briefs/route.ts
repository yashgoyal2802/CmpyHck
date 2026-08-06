import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { HTTP_STATUS, USER_MESSAGE, toBriefError } from "@/lib/brief/errors";
import { generateBrief } from "@/lib/brief/pipeline";
import { getProvider } from "@/lib/providers";
import { getStorage } from "@/lib/storage";

/** Grounded research is slow; give it room before the platform cuts us off. */
export const maxDuration = 120;

export async function POST(request: Request) {
  // Middleware already gates this route. Re-checking here is defence in depth:
  // this handler burns research quota, so it should never rely on a single gate.
  if (!(await getSessionUser())) {
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
    const ttlEnv = Number(process.env.CACHE_TTL_SECONDS);
    const brief = await generateBrief(companyName, {
      provider: getProvider(),
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
