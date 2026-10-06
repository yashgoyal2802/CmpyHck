import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/auth/server";
import { DEMO_ORGANIZER_ENTRIES } from "@/lib/demo/organizerFixtures";
import { getStorage, ORGANIZER_STATUSES, type ConfidenceRating, type OrganizerStatus } from "@/lib/storage";

function unauthorized() {
  return NextResponse.json(
    { error: { kind: "unauthorized", message: "Sign in to use the organizer." } },
    { status: 401 },
  );
}

/**
 * A demo session is authenticated (middleware let it through) but not
 * signed in to a real account - 403, not 401, matching how `search_only`'s
 * restriction is already distinguished in middleware.ts.
 */
function demoRejected() {
  return NextResponse.json(
    { error: { kind: "forbidden", message: "Sign in to use the organizer." } },
    { status: 403 },
  );
}

export async function GET() {
  const session = await getSessionAccount();
  if (!session) return unauthorized();

  // A read, not a write - served from the same frozen fixture pipeline the
  // organizer/saved pages show, never the real store. See organizerFixtures.ts.
  if (session.isDemo) return NextResponse.json({ entries: DEMO_ORGANIZER_ENTRIES });

  const entries = await getStorage().listOrganizerEntries(session.username);
  return NextResponse.json({ entries });
}

interface OrganizerUpsertBody {
  companyKey?: unknown;
  resolvedName?: unknown;
  status?: unknown;
  bookmarked?: unknown;
  interviewDate?: unknown;
  confidence?: unknown;
}

function isOrganizerStatus(value: unknown): value is OrganizerStatus {
  return typeof value === "string" && (ORGANIZER_STATUSES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const session = await getSessionAccount();
  if (!session) return unauthorized();
  // `getSessionUser()`'s old truthy-username check would have let a demo
  // session through to a real storage write here - see add-demo-mode
  // design.md for why this needs its own explicit check.
  if (session.isDemo) return demoRejected();
  const username = session.username;

  let body: OrganizerUpsertBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: "Malformed request body." } },
      { status: 400 },
    );
  }

  const companyKey = typeof body.companyKey === "string" ? body.companyKey.trim() : "";
  const resolvedName = typeof body.resolvedName === "string" ? body.resolvedName.trim() : "";
  if (!companyKey || !resolvedName) {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: "companyKey and resolvedName are required." } },
      { status: 400 },
    );
  }

  if (!isOrganizerStatus(body.status)) {
    return NextResponse.json(
      {
        error: {
          kind: "invalid_input",
          message: `status must be one of: ${ORGANIZER_STATUSES.join(", ")}.`,
        },
      },
      { status: 400 },
    );
  }
  const status = body.status;

  const bookmarked = Boolean(body.bookmarked);

  const interviewDate =
    typeof body.interviewDate === "string" && body.interviewDate.trim().length > 0
      ? body.interviewDate.trim()
      : null;

  const confidenceRaw = Number(body.confidence);
  const confidence: ConfidenceRating | null =
    Number.isInteger(confidenceRaw) && confidenceRaw >= 1 && confidenceRaw <= 5
      ? (confidenceRaw as ConfidenceRating)
      : null;

  const entry = await getStorage().putOrganizerEntry({
    username,
    companyKey,
    resolvedName,
    status,
    bookmarked,
    interviewDate,
    confidence,
  });

  return NextResponse.json({ entry });
}

export async function DELETE(request: Request) {
  const session = await getSessionAccount();
  if (!session) return unauthorized();
  if (session.isDemo) return demoRejected();

  const companyKey = new URL(request.url).searchParams.get("companyKey")?.trim();
  if (!companyKey) {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: "companyKey query param is required." } },
      { status: 400 },
    );
  }

  await getStorage().deleteOrganizerEntry(session.username, companyKey);
  return NextResponse.json({ ok: true });
}
