import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Analysis } from "./analyses";
import { NOTION_DATA_SOURCE_ID, analysisFromBlocks, notionBlocks, notionProps } from "./notion";

// Appels à l'API Notion, côté serveur uniquement : la clé NOTION_API_KEY (Secrets Lovable) ne part jamais au navigateur.
const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";

async function notion(path: string, method: string, body?: unknown) {
  const key = process.env["NOTION_API_KEY"];
  if (!key) throw new Error("Notion n’est pas configuré : ajoutez le secret NOTION_API_KEY.");
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const code = String(data["code"] ?? r.status);
    if (code === "object_not_found") throw new Error("Base Notion introuvable : connectez l’intégration à la page Contre-feu (⋯ › Connexions).");
    if (code === "unauthorized") throw new Error("Clé Notion refusée : vérifiez le secret NOTION_API_KEY.");
    if (code === "rate_limited") throw new Error("Notion est saturé, réessayez dans quelques secondes.");
    throw new Error(`Notion a refusé la requête (${code}).`);
  }
  return data;
}
const ds = () => process.env["NOTION_DATA_SOURCE_ID"] || NOTION_DATA_SOURCE_ID;

async function children(id: string) {
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`, "GET");
    all.push(...(r["results"] as Record<string, unknown>[]));
    cursor = r["has_more"] ? String(r["next_cursor"]) : undefined;
  } while (cursor);
  return all;
}

const SaveInput = z.object({ analysis: z.object({ id: z.string().min(1).max(100) }).passthrough(), pm: z.string().max(200) });

/** Crée ou met à jour la page Notion de l'analyse (retrouvée par « ID analyse »). */
export const saveToNotion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const a = data.analysis as unknown as Analysis;
      const found = await notion(`/data_sources/${ds()}/query`, "POST", { filter: { property: "ID analyse", rich_text: { equals: a.id } }, page_size: 1 });
      const existing = (found["results"] as { id: string; url: string }[])[0];
      const props = notionProps(a, data.pm);
      const blocks = notionBlocks(a, data.pm);
      if (!existing) {
        const page = await notion("/pages", "POST", { parent: { type: "data_source_id", data_source_id: ds() }, properties: props, children: blocks.slice(0, 100) });
        if (blocks.length > 100) await notion(`/blocks/${page["id"]}/children`, "PATCH", { children: blocks.slice(100) });
        return { url: String(page["url"]), error: "" };
      }
      await notion(`/pages/${existing.id}`, "PATCH", { properties: props });
      for (const b of await children(existing.id)) await notion(`/blocks/${b["id"]}`, "DELETE");
      for (let i = 0; i < blocks.length; i += 100) await notion(`/blocks/${existing.id}/children`, "PATCH", { children: blocks.slice(i, i + 100) });
      return { url: existing.url, error: "" };
    } catch (e) {
      return { url: "", error: e instanceof Error ? e.message : "Notion n’a pas répondu." };
    }
  });

/** Relit toutes les analyses de la base Notion. */
export const loadFromNotion = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const pages: { id: string }[] = [];
    let cursor: string | undefined;
    do {
      const r = await notion(`/data_sources/${ds()}/query`, "POST", { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
      pages.push(...(r["results"] as { id: string }[]));
      cursor = r["has_more"] ? String(r["next_cursor"]) : undefined;
    } while (cursor);
    const analyses: Analysis[] = [];
    let skipped = 0;
    for (const p of pages) {
      const a = analysisFromBlocks(await children(p.id));
      if (a) analyses.push(a); else skipped++;
    }
    return { json: JSON.stringify(analyses), skipped, error: "" };
  } catch (e) {
    return { json: "[]", skipped: 0, error: e instanceof Error ? e.message : "Notion n’a pas répondu." };
  }
});
