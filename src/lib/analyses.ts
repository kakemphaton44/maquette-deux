// Modèle d'une analyse Contre-feu (maquette fusionnée) et règles métier pures, testables.

export type Kind = "concurrent" | "detournement";
export type ReadStatus = "sait" | "suppose" | "ignore";
export type Support = "etayee" | "reformulee" | "non";
export type YesNo = "oui" | "non";
export type Motif = "erreur" | "contexte";
export type ReviewHolds = "oui" | "en_partie" | "non";

export interface ReadingItem {
  id: string;
  label: string;
  status: ReadStatus;
  text: string;
  source: string;
  quote?: string | undefined;
  /** Proposition initiale de l'IA, conservée après une correction. */
  orig?: { text: string; status: ReadStatus } | undefined;
}

export interface Criterion {
  id: string;
  name: string;
  cat?: "apporte" | "coute" | "urgence" | undefined;
  ai: number;
  value: number;
  why: string;
  motif?: Motif | undefined;
  note?: string | undefined;
}

export interface Premise { status: ReadStatus; text: string; src: string }

export interface Objection {
  id: string;
  option: string;
  role: string;
  text: string;
  support: Support;
  initial?: string | undefined;
  premises: Premise[];
  useful?: YesNo | undefined;
  novel?: YesNo | undefined;
}

export interface Question { id: string; text: string; why: string; answer: string; skipped: boolean }
export interface Scenario { name: string; proof: string; title: string; desc: string; gains: string[]; facts: string[]; note?: string | undefined }
export interface Manque { id: string; proof: string; title: string; appui: string }
export interface ProOpp { label: string; pro: string[]; con: string[] }

export interface CorrectionLog { at: string; name: string; from: string; to: string; ai: string; motif: Motif; note?: string | undefined }

export interface Reopening { at: string; was: "evaluee" | "abandonnee"; completedAt?: string | undefined; decision?: string | undefined }

export interface Analysis {
  id: string;
  kind: Kind;
  title: string;
  signal: string;
  prevu: string;
  observe: string;
  contexte: string;
  position: string;
  positionWhy: string;
  risks: string[];
  launched: boolean;
  fiches: Record<string, string>;
  questions: Question[];
  questionsDone: boolean;
  scenarios: Scenario[];
  manques: Manque[];
  manqueId?: string | undefined;
  po?: ProOpp | undefined;
  step: number;
  summary: string;
  reading: ReadingItem[];
  criteria: Criterion[];
  blocking: boolean;
  aiTrendInitial?: string | undefined;
  staleEnjeu: boolean;
  staleObjections: boolean;
  objections: Objection[];
  corrections: CorrectionLog[];
  decision?: string | undefined;
  decisionWhy: string;
  keyObjection?: string | undefined;
  reviewDate: string;
  trigger: string;
  measure: string;
  pertinence?: number | undefined;
  effort?: number | undefined;
  techFail?: string | undefined;
  abandoned: boolean;
  completedAt?: string | undefined;
  review?: { holds: ReviewHolds; verified?: YesNo | "na" | undefined; note: string; date: string } | undefined;
  /** Analyse d'origine, quand celle-ci a été dupliquée. */
  duplicatedFrom?: { id: string; title: string } | undefined;
  /** Réouvertures après clôture ou abandon : la version close précédente reste tracée. */
  reopenings?: Reopening[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export const NSP = "Je ne sais pas encore";
export const TRP = "Tolérer pour l’instant, revoir";
export const PART = "Partagée";

export const KIND: Record<Kind, { code: string; name: string; intro: string; options: string[]; decisions: string[]; roles: string[]; resultLabel: string; desc: Record<string, string> }> = {
  concurrent: {
    code: "UC-01", name: "Mouvement concurrent",
    intro: "Un concurrent lance ou prépare une évolution susceptible de menacer votre produit.",
    options: ["Surveiller", "Ajuster", "Riposter"], decisions: ["Surveiller", "Ajuster", "Riposter"],
    roles: ["Concurrent", "Nos clients", "Marché"], resultLabel: "Zone de menace",
    desc: { Surveiller: "Ne rien changer, suivre le signal. Une revue datée ou un signal déclencheur.", Ajuster: "Adapter le produit ou le discours, sans tout réorienter.", Riposter: "Répondre frontalement : fonctionnalité, prix ou offre." },
  },
  detournement: {
    code: "UC-05", name: "Détournement d’usage",
    intro: "Des utilisateurs détournent votre produit pour couvrir un besoin qu’il ne sert pas correctement.",
    options: ["Tolérer", "Corriger", "Adopter"], decisions: ["Tolérer", TRP, "Corriger", "Adopter"],
    roles: ["Qui détourne l’usage", "Qui utilise le résultat", "Qui porte le coût"], resultLabel: "Tendance d’usage",
    desc: { Tolérer: "Laisser l’usage en l’état, sous surveillance. Une revue datée ou un signal déclencheur.", [TRP]: "Garder l’usage pour l’instant malgré son coût. Réexamen daté ou signal déclencheur, et un élément à mesurer.", Corriger: "Ramener l’usage dans le cadre prévu.", Adopter: "Intégrer l’usage au produit, proprement." },
  },
};

/* Format des champs obligatoires : vide = « à remplir » (contour seul) ; mal formé = message sous le champ. */
/** Champ texte libre : il doit contenir au moins une lettre, pas uniquement des chiffres ou de la ponctuation. */
export function textFormatError(v: string): string | null {
  const t = v.trim();
  if (!t || /\p{L}/u.test(t)) return null;
  return /\d/.test(t) ? "Format incorrect : saisissez du texte, pas uniquement des chiffres." : "Format incorrect : saisissez du texte, avec des mots.";
}
/** Nom ou initiales : lettres, espaces, tirets, apostrophes et points seulement. */
export function nameFormatError(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/\d/.test(t)) return "Format incorrect : un nom ne contient pas de chiffres.";
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(t)) return "Format incorrect : utilisez seulement des lettres, espaces, tirets ou points.";
  return null;
}

/** Un nom et un type de situation se choisissent ensemble, avant de lancer l’analyse. */
export function launchMissing(name: string, kind: Kind | null): ("nom" | "situation")[] {
  const missing: ("nom" | "situation")[] = [];
  if (!name.trim() || nameFormatError(name)) missing.push("nom");
  if (!kind) missing.push("situation");
  return missing;
}

/** Critères proposés par l'IA. Concurrent : échelle 1 à 3 ; détournement : 1 à 5. */
export const CRITERIA: Record<Kind, { id: string; name: string; cat?: Criterion["cat"] }[]> = {
  concurrent: [
    { id: "recouvrement", name: "Proximité avec notre produit" },
    { id: "exposition", name: "Clients exposés" },
    { id: "maturite", name: "Avancement du concurrent" },
    { id: "capacite", name: "Moyens du concurrent" },
    { id: "urgence", name: "Urgence" },
  ],
  detournement: [
    { id: "valeur", cat: "apporte", name: "Valeur pour les utilisateurs concernés" },
    { id: "ampleur", cat: "apporte", name: "Ampleur de l’usage" },
    { id: "effort", cat: "coute", name: "Effort pour l’adopter proprement" },
    { id: "risque", cat: "coute", name: "Risque pour le produit" },
    { id: "urgence", cat: "urgence", name: "Urgence" },
  ],
};
export const scaleMax = (k: Kind) => (k === "concurrent" ? 3 : 5);

export const STEPS = [
  { label: "Nouvelle analyse", sub: "le signal et votre position" },
  { label: "Analyse de la situation", sub: "questions, on sait / on suppose / on ignore" },
  { label: "Évaluation de l’enjeu", sub: "critères et tendance" },
  { label: "Mise à l’épreuve des options", sub: "trois rôles attaquent chaque option" },
  { label: "Décision et synthèse", sub: "votre décision, distincte de l’IA" },
  { label: "Évaluation des objections", sub: "utile ? nouvelle ? issue calculée" },
] as const;
export const DECIDE_STEP = 4;
export const EVAL_STEP = 5;

/** Fiches de contexte : champs facultatifs, laissés vides s'ils sont inconnus. */
export const FICHES: Record<Kind, { id: string; title: string; fields: { key: string; label: string }[] }[]> = {
  concurrent: [
    { id: "produit", title: "Fiche contexte produit", fields: [
      { key: "cible", label: "Cibles" }, { key: "fonctions", label: "Fonctions clés" },
      { key: "existant", label: "Ce que vous proposez déjà sur ce sujet" }, { key: "positionnement", label: "Positionnement face aux concurrents" } ] },
    { id: "concurrent", title: "Fiche concurrent", fields: [
      { key: "nom", label: "Nom du concurrent" }, { key: "cible", label: "Cible" },
      { key: "forces", label: "Forces connues" }, { key: "capacite", label: "Capacité de livraison" } ] },
  ],
  detournement: [
    { id: "usage", title: "Fiche contexte d’usage", fields: [
      { key: "module", label: "Module concerné" }, { key: "users", label: "Utilisateurs" },
      { key: "regles", label: "Règles ou comportements notables du module" }, { key: "conservation", label: "Contraintes de conservation des données" } ] },
  ],
};
export const ficheKey = (fiche: string, field: string) => `${fiche}.${field}`;
/** Champs de fiche restés vides, pour l'avertissement « contexte incomplet ». */
export function missingContext(a: Analysis): string[] {
  return FICHES[a.kind].flatMap((f) => f.fields.filter((x) => !(a.fiches?.[ficheKey(f.id, x.key)] ?? "").trim()).map((x) => x.label));
}
export function ficheText(a: Analysis): string {
  return FICHES[a.kind].map((f) => `${f.title} :\n` + f.fields.map((x) => `- ${x.label} : ${(a.fiches?.[ficheKey(f.id, x.key)] ?? "").trim() || "(non renseigné)"}`).join("\n")).join("\n");
}

export const READ_LABEL: Record<ReadStatus, string> = { sait: "On sait", suppose: "On suppose", ignore: "On ignore" };
export const SUPPORT_LABEL: Record<Support, string> = { etayee: "Étayée", reformulee: "Reformulée", non: "Non étayée" };
export const MOTIF_LABEL: Record<Motif, string> = { erreur: "Erreur de l’IA", contexte: "Information contextuelle" };
export const CONF = ["faible", "moyenne", "élevée"] as const;

export function newAnalysis(kind: Kind, id: string, now: Date): Analysis {
  const iso = now.toISOString();
  return {
    id, kind, title: "", signal: "", prevu: "", observe: "", contexte: "", position: "", positionWhy: "", risks: [""],
    launched: false, fiches: {}, questions: [], questionsDone: false, scenarios: [], manques: [], step: 0, summary: "", reading: [], criteria: [], blocking: false, staleEnjeu: false, staleObjections: false,
    objections: [], corrections: [], decisionWhy: "", reviewDate: "", trigger: "", measure: "", abandoned: false, createdAt: iso, updatedAt: iso,
  };
}

/** Complète les analyses enregistrées avec une version antérieure. */
export function normalize(a: Analysis): Analysis {
  return { ...a, title: a.title ?? "", signal: a.signal ?? "", observe: a.observe ?? "", prevu: a.prevu ?? "", contexte: a.contexte ?? "", summary: a.summary ?? "", risks: a.risks ?? [], fiches: a.fiches ?? {}, questions: a.questions ?? [], questionsDone: a.questionsDone ?? !!a.launched, scenarios: a.scenarios ?? [], manques: a.manques ?? [] };
}

export const filled = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
export const titleOf = (a: Analysis) => {
  if ((a.title ?? "").trim()) return a.title.trim();
  const src = (a.kind === "concurrent" ? a.signal ?? "" : (a.observe ?? "") || (a.prevu ?? "")).trim();
  if (!src) return "Analyse sans titre";
  return src.length > 64 ? src.slice(0, 61).trim() + "…" : src;
};

/** Ce qui manque pour lancer l'analyse. */
export function describeErrors(a: Analysis): string[] {
  const e: string[] = [];
  if (a.kind === "concurrent") {
    if (!a.signal.trim()) e.push("Décrivez le signal concurrent en une phrase au moins.");
    else if (textFormatError(a.signal)) e.push("Signal concurrent : saisissez du texte, pas uniquement des chiffres.");
  } else {
    if (!a.prevu.trim()) e.push("Décrivez l’usage prévu.");
    else if (textFormatError(a.prevu)) e.push("Usage prévu : saisissez du texte, pas uniquement des chiffres.");
    if (!a.observe.trim()) e.push("Décrivez l’usage observé.");
    else if (textFormatError(a.observe)) e.push("Usage observé : saisissez du texte, pas uniquement des chiffres.");
  }
  if (!a.position) e.push("Choisissez votre position de départ.");
  return e;
}

const avg = (xs: number[]) => xs.reduce((p, c) => p + c, 0) / xs.length;
const fmt = (x: number) => x.toFixed(1).replace(".", ",");
const lvlCat = (x: number) => (x >= 3.5 ? "forte" : x < 2.5 ? "faible" : "partagée");
const Z = ["Surveiller", "Ajuster", "Riposter"];

export interface Trend { label: string; conf: number; lines: string[]; reasons: string[]; fast: boolean; partagee: boolean }

/** Tendance calculée à partir des critères (valeurs retenues) et de la lecture. */
export function trend(kind: Kind, criteria: Criterion[], reading: ReadingItem[], blocking: boolean, useAI = false): Trend | null {
  if (!criteria.length) return null;
  const v: Record<string, number> = {};
  criteria.forEach((c) => (v[c.id] = useAI ? c.ai : c.value));
  const unknown = reading.filter((i) => i.status === "ignore").length;
  let conf = unknown >= 3 ? 0 : unknown >= 1 ? 1 : 2;
  const reasons = [unknown === 0 ? "aucune information dans « On ignore »" : `${unknown} information${unknown > 1 ? "s" : ""} dans « On ignore »`];
  const lines: string[] = [];
  if (kind === "concurrent") {
    const R = v["recouvrement"] ?? 1, E = v["exposition"] ?? 1, M = v["maturite"] ?? 1, C = v["capacite"] ?? 1, U = v["urgence"] ?? 1;
    let z = R === 3 && E === 3 && (M >= 2 || U === 3) ? 2 : R >= 2 && (E >= 2 || U >= 2) ? 1 : 0;
    const base = z;
    lines.push(z === 2 ? "Règle « Riposter » remplie : notre produit est directement concerné, des clients sont fortement exposés, et le concurrent est au moins moyennement avancé ou l’urgence est forte."
      : z === 1 ? "Règle « Ajuster » : notre produit est au moins moyennement concerné, et les clients exposés ou l’urgence sont au moins au niveau moyen. La règle « Riposter » n’est pas remplie."
      : "Ni « Riposter » ni « Ajuster » ne sont remplies : zone « Surveiller ».");
    if (C === 1 && z > 0) { z--; lines.push(`Moyens du concurrent faibles : zone abaissée d’un cran (${Z[base]} → ${Z[z]}).`); }
    return { label: Z[z]!, conf, lines, reasons, fast: false, partagee: false };
  }
  const ap = avg([v["valeur"] ?? 1, v["ampleur"] ?? 1]), co = avg([v["effort"] ?? 1, v["risque"] ?? 1]), ur = v["urgence"] ?? 1;
  const ca = lvlCat(ap), cc = lvlCat(co);
  let label: string;
  if (blocking && !useAI) { label = "Corriger"; lines.push("Critère bloquant (sécurité, données ou juridique) identifié : tendance « Corriger », quels que soient les scores."); }
  else if (ca === "partagée" || cc === "partagée") { label = PART; lines.push(`Apporte ${ca} (${fmt(ap)}), Coûte ${cc} (${fmt(co)}) : au moins une catégorie partagée, aucune tendance catégorique.`); }
  else {
    const M: Record<string, string> = { "forte|faible": "Adopter", "forte|forte": TRP, "faible|faible": "Tolérer", "faible|forte": "Corriger" };
    label = M[`${ca}|${cc}`]!; lines.push(`Apporte ${ca} (${fmt(ap)}) · Coûte ${cc} (${fmt(co)}) → ${label}.`);
  }
  const partagee = label === PART;
  if (partagee) { conf = Math.max(0, conf - 1); reasons.push("catégorie partagée : confiance abaissée d’un niveau"); }
  const fast = ur >= 4;
  if (fast) lines.push("Urgence ≥ 4 : la tendance ne change pas ; signal « À revoir vite » ajouté.");
  return { label, conf, lines, reasons, fast, partagee };
}

export type Solidity = "solide" | "partielle" | "fragile";
/** Solidité de l'attaque : solide si au moins deux objections étayées, partielle s'il y en a une, fragile sinon. */
export function solidity(a: Analysis, option: string): Solidity {
  const n = a.objections.filter((o) => o.option === option && o.support === "etayee").length;
  return n >= 2 ? "solide" : n === 1 ? "partielle" : "fragile";
}

export const isEvaluated = (o: Objection) => !!o.useful && !!o.novel;

/** Options retenues pour l'évaluation : celle de la décision et celle de la position de départ (si ce sont des options). */
export function retainedOptions(a: Analysis): string[] {
  const opts = KIND[a.kind].options;
  const asOption = (v?: string) => (v === TRP ? "Tolérer" : v);
  const r = [asOption(a.decision), asOption(a.position)].filter((v): v is string => !!v && opts.includes(v));
  return opts.filter((o) => r.includes(o));
}
/** Objections à évaluer : celles des options retenues ; toutes si aucune décision ne correspond à une option. */
export function objectionsToEvaluate(a: Analysis): Objection[] {
  const r = retainedOptions(a);
  return r.length ? a.objections.filter((o) => r.includes(o.option)) : a.objections;
}
export function evalStats(a: Analysis) {
  const xs = objectionsToEvaluate(a);
  const done = xs.filter(isEvaluated).length;
  return { done, total: xs.length, complete: xs.length > 0 && done === xs.length };
}

export interface Outcome { label: string; success: boolean; useful: number; lines: string[] }
/** Issue calculée : une objection compte comme apport utile uniquement si « utile » et « nouvelle » sont « Oui ». */
export function outcome(a: Analysis): Outcome | null {
  const es = evalStats(a);
  if (!es.complete || !a.decision) return null;
  const useful = objectionsToEvaluate(a).filter((o) => o.useful === "oui" && o.novel === "oui").length;
  const none = a.position === NSP, changed = !none && a.decision !== a.position;
  const uL = `${useful} objection${useful > 1 ? "s" : ""} jugée${useful > 1 ? "s" : ""} à la fois utile${useful > 1 ? "s" : ""} pour décider et nouvelle${useful > 1 ? "s" : ""}.`;
  const dL = none ? `Sans position de départ : décision construite pendant l’analyse (${a.decision}).` : changed ? `Décision changée : ${a.position} → ${a.decision}.` : `Décision inchangée : ${a.position}.`;
  const rule = "Règle : une objection compte comme apport utile uniquement si les deux réponses sont « Oui ».";
  if (useful === 0) return { label: "Échec", success: false, useful, lines: ["Aucune objection jugée à la fois utile et nouvelle.", dL, ...(changed ? ["Le changement de décision vient d’ailleurs que des objections."] : []), rule] };
  if (none) return { label: "Succès · décision construite", success: true, useful, lines: [uL, dL, rule] };
  if (changed) return { label: "Succès fort", success: true, useful, lines: [uL, dL, rule] };
  return { label: "Succès", success: true, useful, lines: [uL, dL + " Décision confortée, mieux argumentée.", rule] };
}

export function decideErrors(a: Analysis, aiTrend: string | null): string[] {
  const e: string[] = [];
  if (!a.decision) e.push("Choisissez une décision.");
  if (a.decision && aiTrend && a.decision !== aiTrend && !a.decisionWhy.trim()) e.push("Votre décision diffère de la tendance proposée par l’IA : expliquez ce qui motive l’écart.");
  else if (textFormatError(a.decisionWhy)) e.push("Pourquoi ce choix : saisissez du texte, pas uniquement des chiffres.");
  if (!a.reviewDate && !a.trigger.trim()) e.push("Indiquez une date de revue ou un signal déclencheur.");
  else if (textFormatError(a.trigger)) e.push("Signal déclencheur : décrivez un événement, pas uniquement des chiffres.");
  if (!a.measure.trim()) e.push("Indiquez une idée de mesure.");
  else if (textFormatError(a.measure)) e.push("Idée de mesure : décrivez l’indicateur, pas uniquement un chiffre.");
  return e;
}
export function closeErrors(a: Analysis): string[] {
  const e: string[] = [];
  const s = evalStats(a);
  if (!s.complete) e.push(`${s.total - s.done} objection${s.total - s.done > 1 ? "s" : ""} reste${s.total - s.done > 1 ? "nt" : ""} à évaluer.`);
  return e;
}

export type Status = "en_cours" | "eval_incomplete" | "bloquee" | "evaluee" | "abandonnee";
export function status(a: Analysis): Status {
  if (a.abandoned) return "abandonnee";
  if (a.completedAt) return "evaluee";
  if (a.techFail) return "bloquee";
  if (a.step >= EVAL_STEP) return "eval_incomplete";
  if (a.staleEnjeu || a.staleObjections) return "bloquee";
  return "en_cours";
}
export const STATUS: Record<Status, { label: string; glyph: string; def: string }> = {
  en_cours: { label: "En cours", glyph: "◐", def: "reprenable à l’étape atteinte." },
  eval_incomplete: { label: "Évaluation incomplète", glyph: "…", def: "objections restant à évaluer ; reprenable." },
  bloquee: { label: "Bloquée", glyph: "‖", def: "une action est requise avant de continuer (regénérer une étape ou relancer l’IA)." },
  evaluee: { label: "Évaluée", glyph: "✓", def: "toutes les objections évaluées, issue calculée ; consultable en détail, peut être rouverte ou dupliquée." },
  abandonnee: { label: "Abandonnée", glyph: "—", def: "arrêtée par vous, sans issue ; peut être reprise ou dupliquée." },
};

/** Recherche et filtres de l'historique. "tous" laisse le critère ouvert. */
export interface AnalysisFilter { q: string; kind: Kind | "tous"; status: Status | "tous" }
export const NO_FILTER: AnalysisFilter = { q: "", kind: "tous", status: "tous" };

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Les analyses qui correspondent à la recherche (sans accents) et aux filtres type / statut. */
export function filterAnalyses(list: Analysis[], f: AnalysisFilter): Analysis[] {
  const words = fold(f.q).split(/\s+/).filter(Boolean);
  return list.filter((a) => {
    if (f.kind !== "tous" && a.kind !== f.kind) return false;
    if (f.status !== "tous" && status(a) !== f.status) return false;
    if (!words.length) return true;
    const hay = fold([titleOf(a), KIND[a.kind].name, a.signal, a.observe, a.contexte, a.summary ?? "", a.decision ?? "", ...(a.risks ?? [])].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/** Bilan des revues pour l'accueil. */
export function reviewStats(list: Analysis[]) {
  const r = list.filter((a) => a.review);
  const c = (h: ReviewHolds) => r.filter((a) => a.review!.holds === h).length;
  return { count: r.length, oui: c("oui"), partie: c("en_partie"), non: c("non") };
}

/** Texte brut de la synthèse, à coller dans un message. */
export function synthesisText(a: Analysis, pm: string): string {
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const key = a.objections.find((o) => o.id === a.keyObjection);
  return [
    `Contre-feu · ${titleOf(a)}`,
    `${KIND[a.kind].name}${pm ? " · " + pm : ""}`,
    "",
    `Situation : ${a.summary || (a.kind === "concurrent" ? a.signal : a.observe)}`,
    `Position de départ : ${a.position}${a.positionWhy ? " — " + a.positionWhy : ""}`,
    `Recommandation de Contre-feu (IA) : ${t?.label ?? "—"} · confiance ${t ? CONF[t.conf] : "—"}${a.aiTrendInitial && a.aiTrendInitial !== t?.label ? ` (proposition initiale : ${a.aiTrendInitial})` : ""}`,
    `Décision du PM : ${a.decision ?? "—"}`,
    a.decisionWhy ? `Pourquoi : ${a.decisionWhy}` : "",
    key ? `Objection déterminante (${key.role}, ${key.option}) : « ${key.text} »` : "",
    `Revue : ${a.reviewDate ? new Date(a.reviewDate).toLocaleDateString("fr-FR") : ""}${a.trigger ? (a.reviewDate ? " ou " : "") + a.trigger : ""} · mesure : ${a.measure}`,
    filled(a.risks).length ? `Risques déjà identifiés : ${filled(a.risks).join(" ; ")}` : "",
    "",
    "Contre-feu éclaire la décision mais ne décide pas.",
  ].filter((x, i, arr) => x !== "" || arr[i - 1] !== "").join("\n");
}

/** Copie qui repart du même contexte : description, fiches et risques. La position de départ est à redonner, l'IA repart de zéro. */
export function duplicateAnalysis(a: Analysis, id: string, now: Date): Analysis {
  return {
    ...newAnalysis(a.kind, id, now),
    title: `${titleOf(a)} (copie)`, signal: a.signal, prevu: a.prevu, observe: a.observe, contexte: a.contexte,
    fiches: { ...a.fiches }, risks: a.risks.length ? [...a.risks] : [""], duplicatedFrom: { id: a.id, title: titleOf(a) },
  };
}

/** Rouvre une analyse évaluée ou abandonnée : elle redevient modifiable à partir de l'évaluation des objections. */
export function reopenAnalysis(a: Analysis, now: Date): Analysis {
  const s = status(a);
  if (s !== "evaluee" && s !== "abandonnee") return a;
  const log: Reopening = { at: now.toISOString(), was: s, completedAt: a.completedAt, decision: a.decision };
  return { ...a, completedAt: undefined, abandoned: false, reopenings: [...(a.reopenings ?? []), log] };
}
