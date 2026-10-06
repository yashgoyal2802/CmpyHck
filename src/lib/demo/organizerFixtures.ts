import { companyCacheKey, normalizeCompanyName } from "@/lib/brief/normalize";
import { DEMO_USERNAME } from "@/lib/auth/server";
import type { OrganizerEntry } from "@/lib/storage/types";

function entry(
  resolvedName: string,
  status: OrganizerEntry["status"],
  opts: Partial<Pick<OrganizerEntry, "bookmarked" | "interviewDate" | "confidence">> = {},
): OrganizerEntry {
  return {
    username: DEMO_USERNAME,
    companyKey: companyCacheKey(normalizeCompanyName(resolvedName)),
    resolvedName,
    status,
    bookmarked: opts.bookmarked ?? false,
    interviewDate: opts.interviewDate ?? null,
    confidence: opts.confidence ?? null,
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Frozen fixture pipeline for the demo session (add-demo-mode): spans four
 * of the six pipeline stages so a visitor sees the organizer board's actual
 * shape (columns, stats row) rather than an empty-state message, without
 * ever reading or writing real per-account organizer storage. Company names
 * match `src/fixtures/briefs.ts` so searching one of them from the demo
 * also lines up with its tracked status here. Only Acme Consulting is
 * bookmarked - the Saved page shows exactly this one entry.
 */
export const DEMO_ORGANIZER_ENTRIES: OrganizerEntry[] = [
  entry("Acme Consulting", "offer", { bookmarked: true, interviewDate: "2026-01-12", confidence: 5 }),
  entry("Northwind Foods", "interview_scheduled", { interviewDate: "2026-02-03" }),
  entry("Helios Tech", "prepping", { confidence: 3 }),
  entry("Meridian Bank", "tracking"),
];
