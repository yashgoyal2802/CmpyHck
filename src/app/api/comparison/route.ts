import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/auth/server";
import { InvalidComparisonError, compareCompanies } from "@/lib/brief/compare";
import { HTTP_STATUS, USER_MESSAGE } from "@/lib/brief/errors";
import { getProvider, getProviderForApiKey } from "@/lib/providers";
import { getStorage } from "@/lib/storage";

/** Up to three parallel brief generations; give it the same room as a single brief. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getSessionAccount();
  if (!session) {
    return NextResponse.json(
      { error: { kind: "unauthorized", message: "Sign in to compare companies." } },
      { status: 401 },
    );
  }
  // A demo session is authenticated but not signed in to a real account -
  // checked before the apiKey check below, which would otherwise wrongly
  // reject it as "not configured" (a demo session has no key by design and
  // never needs one). See add-demo-mode design.md.
  if (session.isDemo) {
    return NextResponse.json(
      { error: { kind: "forbidden", message: "Sign in to compare companies." } },
      { status: 403 },
    );
  }
  // Defensive-depth: middleware already refuses a non-admin session with no
  // key before this route is reached.
  if (session.role !== "admin" && !session.apiKey) {
    return NextResponse.json(
      { error: { kind: "not_configured", message: USER_MESSAGE.not_configured } },
      { status: HTTP_STATUS.not_configured },
    );
  }

  let companies: unknown;
  try {
    const body = await request.json();
    companies = (body as { companies?: unknown })?.companies;
  } catch {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: USER_MESSAGE.invalid_input } },
      { status: 400 },
    );
  }

  if (!Array.isArray(companies) || !companies.every((c) => typeof c === "string")) {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: "Select two or three companies to compare." } },
      { status: 400 },
    );
  }

  try {
    const provider = session.role === "admin" ? getProvider() : getProviderForApiKey(session.apiKey!);
    const results = await compareCompanies(companies, {
      provider,
      storage: getStorage(),
    });

    // Server-side detail for anything that failed; the client only sees the
    // per-company message already attached to each result.
    for (const result of results) {
      if (result.error) console.error(`[comparison] ${result.companyName}: ${result.error.kind}`);
    }

    const allFailed = results.every((r) => r.error);
    return NextResponse.json({ results }, { status: allFailed ? 502 : 200 });
  } catch (error) {
    if (error instanceof InvalidComparisonError) {
      return NextResponse.json(
        { error: { kind: "invalid_input", message: "Select two or three companies to compare." } },
        { status: 400 },
      );
    }
    throw error;
  }
}
