/**
 * Réponses IA simulées, pour travailler l’interface sans clé IA.
 * Actif seulement en développement local, avec AI_MOCK=1 (voir runAI). Jamais en production.
 */
type MockInput = {
  task: "questions" | "lecture" | "enjeu" | "objections";
  kind: "concurrent" | "detournement";
  options: string[];
  roles: string[];
  criteria: { id: string; name: string }[];
};

export function mockAI(d: MockInput): Record<string, unknown> {
  const conc = d.kind === "concurrent";
  const max = conc ? 3 : 5;
  const criteria = d.criteria.map((c, i) => ({ id: c.id, value: Math.min(max, 1 + ((i + 1) % max)), why: `Réponse simulée pour « ${c.name} ».` }));
  if (d.task === "questions") {
    return {
      questions: [
        { text: "Combien de clients sont concernés ?", why: "mesurer l’exposition" },
        { text: "D’où vient l’information ?", why: "juger la fiabilité de la source" },
        { text: "Y a-t-il une échéance connue ?", why: "évaluer l’urgence" },
      ],
    };
  }
  if (d.task === "enjeu") return { criteria, ...(conc ? {} : { blocking: false }) };
  if (d.task === "objections") {
    const support = ["etayee", "reformulee", "non"] as const;
    return {
      objections: d.options.flatMap((o, i) =>
        d.roles.map((r, j) => ({
          option: o, role: r,
          text: `Objection simulée : en tant que ${r.toLowerCase()}, je doute que « ${o} » soit le bon choix ici.`,
          support: support[(i + j) % 3], initial: (i + j) % 3 === 1 ? "Formulation initiale simulée." : "",
          premises: [{ status: "suppose", text: "Prémisse simulée.", src: "Mode IA simulée" }],
        })),
      ),
    };
  }
  return {
    summary: "Lecture simulée de la situation. Ce texte remplace la réponse de l’IA pendant les correctifs visuels.",
    items: [
      { label: "Source", status: "sait", text: "L’information vient d’un échange direct.", source: "Votre description", quote: "" },
      { label: "Volume", status: "suppose", text: "Quelques clients seraient concernés.", source: "Déduit du contexte", quote: "" },
      { label: "Calendrier", status: "ignore", text: "Aucune échéance connue.", source: "Conditionne l’urgence", quote: "" },
      { label: "Clients", status: "ignore", text: "Comptes exposés non identifiés.", source: "Conditionne l’exposition", quote: "" },
    ],
    criteria,
    ...(conc
      ? {
          scenarios: (["Minimal", "Probable", "Ambitieux"] as const).map((name, i) => ({
            name, proof: ["rapportée", "spéculative", "spéculative"][i], title: `Scénario ${name.toLowerCase()} simulé`,
            desc: "Description simulée du scénario.", gains: ["Rétention"], facts: ["Fait simulé"], note: "",
          })),
        }
      : {
          blocking: false,
          manques: [
            { proof: "rapportée", title: "Manque simulé n° 1", appui: "Élément simulé du contexte" },
            { proof: "spéculative", title: "Manque simulé n° 2", appui: "Élément simulé du contexte" },
          ],
          po: { label: "plutôt une opportunité", pro: ["Argument simulé pour"], con: ["Argument simulé contre"] },
        }),
  };
}
