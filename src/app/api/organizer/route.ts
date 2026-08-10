import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStorage, ORGANIZER_STATUSES, type ConfidenceRating, type OrganizerStatus } from "@/lib/storage";

function unauthorized() {
  return NextResponse.json(
    { error: { kind: "unauthorized", message: "Sign in to use the organizer." } },
    { status: 401 },
  );
}

export async function GET() {
  const username = await getSessionUser();
  if (!username) return unauthorized();

  const entries = await getStorage().listOrganizerEntries(username);
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
  const username = await getSessionUser();
  if (!username) return unauthorized();

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
  const username = await getSessionUser();
  if (!username) return unauthorized();

  const companyKey = new URL(request.url).searchParams.get("companyKey")?.trim();
  if (!companyKey) {
    return NextResponse.json(
      { error: { kind: "invalid_input", message: "companyKey query param is required." } },
      { status: 400 },
    );
  }

  await getStorage().deleteOrganizerEntry(username, companyKey);
  return NextResponse.json({ ok: true });
}
