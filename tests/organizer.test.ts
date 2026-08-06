import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "@/lib/storage/memory";

const COMPANY_KEY = "acme consulting";

describe("personal organizer (tasks 7.10-7.11)", () => {
  it("keeps entries private: one user cannot see another's", async () => {
    const storage = createMemoryStorage();

    await storage.putOrganizerEntry({
      username: "priya",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: true,
      interviewDate: null,
      confidence: 4,
    });

    const priyaEntries = await storage.listOrganizerEntries("priya");
    const yashEntries = await storage.listOrganizerEntries("yash");

    expect(priyaEntries).toHaveLength(1);
    expect(yashEntries).toHaveLength(0);
  });

  it("tracks status, date, and confidence independently per user per company", async () => {
    const storage = createMemoryStorage();

    await storage.putOrganizerEntry({
      username: "priya",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: true,
      interviewDate: "2026-09-01",
      confidence: 5,
    });
    await storage.putOrganizerEntry({
      username: "yash",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: false,
      interviewDate: null,
      confidence: 2,
    });

    const priyaEntry = await storage.getOrganizerEntry("priya", COMPANY_KEY);
    const yashEntry = await storage.getOrganizerEntry("yash", COMPANY_KEY);

    expect(priyaEntry).toMatchObject({ prepped: true, interviewDate: "2026-09-01", confidence: 5 });
    expect(yashEntry).toMatchObject({ prepped: false, interviewDate: null, confidence: 2 });
  });

  it("accepts an entry with no interview date set", async () => {
    const storage = createMemoryStorage();

    const entry = await storage.putOrganizerEntry({
      username: "priya",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: false,
      interviewDate: null,
      confidence: null,
    });

    expect(entry.interviewDate).toBeNull();
  });

  it("updates in place rather than creating a duplicate for the same user and company", async () => {
    const storage = createMemoryStorage();

    await storage.putOrganizerEntry({
      username: "priya",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: false,
      interviewDate: null,
      confidence: null,
    });
    await storage.putOrganizerEntry({
      username: "priya",
      companyKey: COMPANY_KEY,
      resolvedName: "Acme Consulting",
      prepped: true,
      interviewDate: null,
      confidence: 3,
    });

    const entries = await storage.listOrganizerEntries("priya");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ prepped: true, confidence: 3 });
  });
});
