import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { InvalidComparisonError, compareCompanies } from "@/lib/brief/compare";
import { USER_MESSAGE } from "@/lib/brief/errors";
import { getProvider } from "@/lib/providers";
import { getStorage } from "@/lib/storage";

/** Up to three parallel brief generations; give it the same room as a single brief. */
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json(
      { error: { kind: "unauthorized", message: "Sign in to compare companies." } },
      { status: 401 },
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
    const results = await compareCompanies(companies, {
      provider: getProvider(),
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
