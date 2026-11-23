// Correspondance analyse ↔ page de la base Notion « Analyses Contre-feu ». Fonctions pures, testées.
import { CONF, KIND, STATUS, filled, objectionsToEvaluate, outcome, status, titleOf, trend, type Analysis } from "./analyses";

/** Base « Analyses Contre-feu » (source de données). Pas un secret : surchargeable par NOTION_DATA_SOURCE_ID. */
export const NOTION_DATA_SOURCE_ID = "42199a00-c05b-80f1-ac9a-000bd7855a15";
/** Légende qui marque les blocs de code contenant l'analyse complète, relus par l'import. */
export const JSON_CAPTION = "contre-feu:analyse";

const MAX = 2000; // longueur maximale d'un texte Notion
const txt = (s: string) => [{ type: "text", text: { content: s.slice(0, MAX) } }];
const rich = (s?: string) => ({ rich_text: s ? txt(s) : [] });
const sel = (name?: string) => ({ select: name ? { name } : null });
const date = (iso?: string) => ({ date: iso ? { start: iso.length > 10 ? iso : iso.slice(0, 10) } : null });
const HOLDS = { oui: "Oui", en_partie: "En partie", non: "Non" } as const;

export function notionProps(a: Analysis, pm: string) {
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const oc = outcome(a);
  return {
    Titre: { title: txt(titleOf(a)) },
    "ID analyse": rich(a.id),
    Type: sel(KIND[a.kind].name),
    Statut: sel(STATUS[status(a)].label),
    "Position de départ": rich(a.position),
    "Recommandation IA": rich(t ? `${t.label} · confiance ${CONF[t.conf]}` : ""),
    "Décision": rich(a.decision),
    Issue: sel(oc?.label),
    "Objections utiles": { number: oc ? objectionsToEvaluate(a).filter((o) => o.useful === "oui" && o.novel === "oui").length : null },
    "Date de revue": date(a.reviewDate),
    "Revue : tient-elle ?": sel(a.review ? HOLDS[a.review.holds] : undefined),
    Auteur: rich(pm),
    "Dupliquée de": rich(a.duplicatedFrom?.id),
    "Créée le": date(a.createdAt),
    "Clôturée le": date(a.completedAt),
    "Mise à jour app": date(a.updatedAt),
  };
}

const para = (s: string) => ({ object: "block", type: "paragraph", paragraph: { rich_text: txt(s) } });
const h2 = (s: string) => ({ object: "block", type: "heading_2", heading_2: { rich_text: txt(s) } });

/** Corps de la page : un résumé lisible, puis l'analyse complète en JSON (découpée pour tenir dans les limites de Notion). */
export function notionBlocks(a: Analysis, pm: string) {
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const key = a.objections.find((o) => o.id === a.keyObjection);
  const lines = [
    `Situation : ${a.summary || (a.kind === "concurrent" ? a.signal : a.observe) || "—"}`,
    `Position de départ : ${a.position || "—"}${a.positionWhy ? ` — ${a.positionWhy}` : ""}`,
    `Recommandation de l’IA : ${t ? `${t.label} · confiance ${CONF[t.conf]}` : "—"}`,
    `Décision${pm ? ` de ${pm}` : ""} : ${a.decision || "—"}${a.decisionWhy ? ` — ${a.decisionWhy}` : ""}`,
    key ? `Objection déterminante (${key.role}, ${key.option}) : « ${key.text} »` : "",
    filled(a.risks).length ? `Risques déjà identifiés : ${filled(a.risks).join(" ; ")}` : "",
  ].filter(Boolean);
  const json = JSON.stringify(a);
  const pieces: string[] = [];
  for (let i = 0; i < json.length; i += MAX) pieces.push(json.slice(i, i + MAX));
  const codes = [];
  for (let i = 0; i < pieces.length; i += 100) {
    codes.push({ object: "block", type: "code", code: { language: "json", caption: txt(JSON_CAPTION), rich_text: pieces.slice(i, i + 100).map((p) => ({ type: "text", text: { content: p } })) } });
  }
  return [
    h2("Résumé"), ...lines.map(para),
    h2("Données de l’analyse"), para("Ne pas modifier : ce bloc est relu par « Importer depuis Notion » dans Contre-feu."),
    ...codes,
  ];
}

type Block = { type?: string; code?: { caption?: { plain_text?: string }[]; rich_text?: { plain_text?: string }[] } };
/** Reconstitue l'analyse à partir des blocs de code marqués d'une page. */
export function analysisFromBlocks(blocks: Block[]): Analysis | null {
  const text = blocks
    .filter((b) => b.type === "code" && b.code?.caption?.map((c) => c.plain_text).join("") === JSON_CAPTION)
    .map((b) => b.code!.rich_text!.map((r) => r.plain_text ?? "").join(""))
    .join("");
  if (!text) return null;
  try {
    const a = JSON.parse(text) as Analysis;
    return a && typeof a.id === "string" ? a : null;
  } catch {
    return null;
  }
}
