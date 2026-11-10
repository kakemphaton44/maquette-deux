// Modèle d'une analyse Contre-feu et règles métier (pures, testables).

export type Kind = "concurrent" | "detournement";
export type Voice = "concurrent" | "clients" | "marche" | "utilisateurs" | "equipe";
export type Verdict = "ecartee" | "a_traiter" | "bloquante";
export type Confidence = "faible" | "moyenne" | "forte";
export type Changed = "oui" | "en_partie" | "non";
export type ReviewOutcome = "tenu" | "partiel" | "pas_tenu";

export interface Objection {
  id: string;
  option: string;
  voice: Voice;
  text: string;
  verdict?: Verdict;
  answer?: string;
}

export interface Analysis {
  id: string;
  kind: Kind;
  title: string;
  signal: string;
  source: string;
  anonymised: boolean;
  startPosition: string;
  startReason: string;
  risks: string[];
  known: string[];
  assumed: string[];
  unknown: string[];
  readingConfidence?: Confidence;
  stake: string;
  threatened: string[];
  severity?: 1 | 2 | 3;
  objections: Objection[];
  decision?: string;
  decisionReason: string;
  changedMind?: Changed;
  decisionConfidence?: Confidence;
  nextSteps: string[];
  abandoned: boolean;
  review?: { outcome: ReviewOutcome; note: string; date: string };
  reviewDue?: string;
  step: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const OPTIONS: Record<Kind, string[]> = {
  concurrent: ["Surveiller", "Ajuster", "Riposter"],
  detournement: ["Tolérer", "Corriger", "Adopter"],
};

export const VOICES: Record<Kind, { id: Voice; label: string; hint: string }[]> = {
  concurrent: [
    { id: "concurrent", label: "Le concurrent", hint: "Comment réagirait-il à cette option ?" },
    { id: "clients", label: "Vos clients", hint: "Qu’est-ce qui les ferait partir ou rester ?" },
    { id: "marche", label: "Le marché", hint: "Tendances, prix, régulation, timing…" },
  ],
  detournement: [
    { id: "utilisateurs", label: "Les utilisateurs", hint: "Ceux qui détournent l’usage : que perdent-ils ?" },
    { id: "equipe", label: "L’équipe", hint: "Support, technique, coûts, risques…" },
    { id: "marche", label: "Le marché", hint: "Concurrents, opportunité, image…" },
  ],
};

export const KIND_LABEL: Record<Kind, string> = {
  concurrent: "Mouvement concurrent",
  detournement: "Détournement d’usage",
};

export const STEPS = ["Décrire", "Comprendre", "Mettre à l’épreuve", "Évaluer", "Décider"] as const;

/** Minimum d'objections par option pour lancer l'évaluation. */
export const MIN_OBJECTIONS_PER_OPTION = 1;
/** Une revue est proposée ce nombre de jours après la décision. */
export const REVIEW_DELAY_DAYS = 30;

export function newAnalysis(kind: Kind, id: string, now: Date): Analysis {
  const iso = now.toISOString();
  return {
    id, kind, title: "", signal: "", source: "", anonymised: false,
    startPosition: "", startReason: "", risks: [""],
    known: [""], assumed: [""], unknown: [""], stake: "", threatened: [""],
    objections: [], decisionReason: "", nextSteps: [""], abandoned: false,
    step: 0, createdAt: iso, updatedAt: iso,
  };
}

/** Raisons qui empêchent de quitter l'étape « Décrire ». */
export function describeErrors(a: Analysis): string[] {
  const e: string[] = [];
  if (!a.title.trim()) e.push("Donnez un titre à l’analyse.");
  if (a.signal.trim().length < 20) e.push("Racontez le signal en quelques phrases (20 caractères minimum).");
  if (!a.anonymised) e.push("Confirmez que la description est anonymisée.");
  if (!a.startPosition) e.push("Choisissez votre position de départ.");
  if (!a.startReason.trim()) e.push("Expliquez votre position en une phrase.");
  return e;
}

export function understandErrors(a: Analysis): string[] {
  const e: string[] = [];
  if (!filled(a.known).length) e.push("Notez au moins un fait connu.");
  if (!a.readingConfidence) e.push("Indiquez la confiance dans votre lecture.");
  if (!a.stake.trim()) e.push("Décrivez l’enjeu.");
  if (!a.severity) e.push("Évaluez la gravité.");
  return e;
}

export function testErrors(a: Analysis): string[] {
  return OPTIONS[a.kind]
    .filter((o) => a.objections.filter((x) => x.option === o && x.text.trim()).length < MIN_OBJECTIONS_PER_OPTION)
    .map((o) => `Ajoutez au moins une objection contre « ${o} ».`);
}

export function evaluateErrors(a: Analysis): string[] {
  const e: string[] = [];
  const missing = realObjections(a).filter((o) => !o.verdict).length;
  if (missing) e.push(`${missing} objection${missing > 1 ? "s" : ""} sans verdict.`);
  if (!a.changedMind) e.push("Dites si l’épreuve a changé votre avis.");
  if (!a.decisionConfidence) e.push("Indiquez votre confiance dans la décision.");
  return e;
}

export function decideErrors(a: Analysis): string[] {
  const e: string[] = [];
  if (!a.decision) e.push("Choisissez une décision.");
  if (!a.decisionReason.trim()) e.push("Justifiez la décision.");
  return e;
}

export const STEP_CHECKS = [describeErrors, understandErrors, testErrors, evaluateErrors, decideErrors];

export const filled = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
export const realObjections = (a: Analysis) => a.objections.filter((o) => o.text.trim());

export type Robustness = "solide" | "ajustements" | "a_revoir";

/** Solidité d'une option : une objection bloquante => à revoir ; une à traiter => ajustements. */
export function optionRobustness(a: Analysis, option: string): Robustness | null {
  const objs = realObjections(a).filter((o) => o.option === option);
  if (!objs.length || objs.some((o) => !o.verdict)) return null;
  if (objs.some((o) => o.verdict === "bloquante")) return "a_revoir";
  if (objs.some((o) => o.verdict === "a_traiter")) return "ajustements";
  return "solide";
}

export const ROBUSTNESS_LABEL: Record<Robustness, string> = {
  solide: "Tient face aux objections",
  ajustements: "Tient avec ajustements",
  a_revoir: "Ne tient pas en l’état",
};

/** Option suggérée : la plus solide, puis la moins contestée. */
export function suggestedOption(a: Analysis): string | null {
  const rank: Record<Robustness, number> = { solide: 0, ajustements: 1, a_revoir: 2 };
  const scored = OPTIONS[a.kind]
    .map((o) => ({ o, r: optionRobustness(a, o), n: realObjections(a).filter((x) => x.option === o && x.verdict !== "ecartee").length }))
    .filter((x) => x.r);
  if (!scored.length) return null;
  scored.sort((x, y) => rank[x.r!] - rank[y.r!] || x.n - y.n);
  return scored[0].o;
}

export type Status = "en_cours" | "eval_incomplete" | "terminee" | "revue_a_faire" | "revue" | "abandonnee";

export function status(a: Analysis, now: Date): Status {
  if (a.abandoned) return "abandonnee";
  if (a.review) return "revue";
  if (a.completedAt) {
    return a.reviewDue && new Date(a.reviewDue) <= now ? "revue_a_faire" : "terminee";
  }
  if (a.step >= 3) return "eval_incomplete";
  return "en_cours";
}

export const STATUS_LABEL: Record<Status, string> = {
  en_cours: "En cours",
  eval_incomplete: "Évaluation incomplète",
  terminee: "Terminée",
  revue_a_faire: "Revue à faire",
  revue: "Revue faite",
  abandonnee: "Abandonnée",
};

export function reviewDueDate(completed: Date): string {
  const d = new Date(completed);
  d.setDate(d.getDate() + REVIEW_DELAY_DAYS);
  return d.toISOString();
}

/** Bilan des revues pour l'accueil. */
export function reviewStats(list: Analysis[]) {
  const reviewed = list.filter((a) => a.review);
  const count = (o: ReviewOutcome) => reviewed.filter((a) => a.review!.outcome === o).length;
  return { total: list.length, reviewed: reviewed.length, tenu: count("tenu"), partiel: count("partiel"), pasTenu: count("pas_tenu") };
}
