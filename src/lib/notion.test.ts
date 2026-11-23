import { describe, expect, it } from "vitest";
import { newAnalysis, type Analysis } from "./analyses";
import { JSON_CAPTION, analysisFromBlocks, notionBlocks, notionProps } from "./notion";

const a = (): Analysis => ({ ...newAnalysis("concurrent", "id-1", new Date("2026-01-01")), signal: "x".repeat(5000), position: "Ajuster", decision: "Riposter", reviewDate: "2026-12-15" });
type Code = { type: string; code?: { caption: { text: { content: string } }[]; rich_text: { text: { content: string } }[] } };
// Notion renvoie plain_text là où on envoie text.content.
const asRead = (bs: Code[]) => bs.map((b) => (b.code ? { type: b.type, code: { caption: b.code.caption.map((c) => ({ plain_text: c.text.content })), rich_text: b.code.rich_text.map((r) => ({ plain_text: r.text.content })) } } : b));

describe("Notion", () => {
  it("propriétés : clé de synchronisation, type, statut, dates", () => {
    const p = notionProps(a(), "Clara");
    expect(p["ID analyse"].rich_text[0]!.text.content).toBe("id-1");
    expect(p.Type.select!.name).toBe("Mouvement concurrent");
    expect(p.Statut.select!.name).toBe("En cours");
    expect(p["Date de revue"].date!.start).toBe("2026-12-15");
    expect(p.Issue.select).toBeNull();
    expect(p.Titre.title[0]!.text.content.length).toBeLessThanOrEqual(2000);
  });
  it("le JSON est découpé en morceaux de 2000 caractères et se relit à l'identique", () => {
    const src = a();
    const blocks = notionBlocks(src, "Clara") as Code[];
    const codes = blocks.filter((b) => b.type === "code");
    expect(codes[0]!.code!.caption[0]!.text.content).toBe(JSON_CAPTION);
    expect(codes.flatMap((c) => c.code!.rich_text).every((r) => r.text.content.length <= 2000)).toBe(true);
    expect(analysisFromBlocks(asRead(blocks) as Parameters<typeof analysisFromBlocks>[0])).toEqual(src);
  });
  it("une page sans données est ignorée", () => {
    expect(analysisFromBlocks([{ type: "paragraph" }])).toBeNull();
  });
});
