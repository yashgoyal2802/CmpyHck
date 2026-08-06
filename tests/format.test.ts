import { describe, expect, it } from "vitest";
import { briefToPlainText } from "@/lib/brief/format";
import { generateBrief } from "@/lib/brief/pipeline";
import { createFakeProvider } from "@/lib/providers/fake";

const provider = createFakeProvider();
const now = () => new Date("2026-08-04T00:00:00.000Z");
const brief = (name: string) => generateBrief(name, { provider, now });

describe("copy-friendly text (task 4.4)", () => {
  it("keeps source references rather than stripping them", () => {
    return brief("Acme Consulting").then((result) => {
      const text = briefToPlainText(result);

      expect(text).toContain("SOURCES");
      for (const source of result.sources) {
        expect(text).toContain(`[${source.id}]`);
        expect(text).toContain(source.title);
      }
    });
  });

  it("marks analysis so a copied brief still separates fact from inference", async () => {
    const text = briefToPlainText(await brief("Acme Consulting"));
    expect(text).toContain("(analysis)");
  });

  it("includes every required section", async () => {
    const text = briefToPlainText(await brief("Northwind Foods"));

    expect(text).toContain("OVERVIEW");
    expect(text).toContain("RECENT NEWS");
    expect(text).toContain("TALKING POINTS");
    expect(text).toContain("QUESTIONS TO ASK");
    expect(text).toContain("4P ANALYSIS");
  });

  it("omits the 4P heading entirely for a sector where it does not apply", async () => {
    const text = briefToPlainText(await brief("Meridian Bank"));
    expect(text).not.toContain("4P ANALYSIS");
  });

  it("carries the unavailable message through instead of an empty section", async () => {
    const text = briefToPlainText(await brief("Quiet Corp"));
    expect(text).toMatch(/no recent relevant news/i);
  });

  it("shows the sector, hedged when classification was uncertain", async () => {
    expect(briefToPlainText(await brief("Acme Consulting"))).toContain("Sector: Consulting");
    expect(briefToPlainText(await brief("Obscure Holdings"))).toMatch(/Sector: .*\(likely\)/);
  });
});
