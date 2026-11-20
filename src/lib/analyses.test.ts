import { describe, expect, it } from "vitest";
import { NSP, TRP, PART, newAnalysis, outcome, solidity, trend, decideErrors, status, launchMissing, filterAnalyses, textFormatError, nameFormatError, describeErrors, NO_FILTER, type Analysis, type Criterion, type Objection } from "./analyses";

const crit = (v: Record<string, number>): Criterion[] => Object.entries(v).map(([id, n]) => ({ id, name: id, ai: n, value: n, why: "" }));
const obj = (p: Partial<Objection>): Objection => ({ id: Math.random().toString(), option: "Ajuster", role: "r", text: "t", support: "non", premises: [], ...p });
const base = (): Analysis => newAnalysis("concurrent", "x", new Date("2026-01-01"));

describe("tendance concurrent", () => {
  it("Riposter quand proximité 3, clients 3, avancement ≥ 2", () => {
    expect(trend("concurrent", crit({ recouvrement: 3, exposition: 3, maturite: 2, capacite: 2, urgence: 1 }), [], false)!.label).toBe("Riposter");
  });
  it("moyens faibles abaissent d'un cran", () => {
    expect(trend("concurrent", crit({ recouvrement: 3, exposition: 3, maturite: 2, capacite: 1, urgence: 1 }), [], false)!.label).toBe("Ajuster");
  });
  it("Surveiller sinon", () => {
    expect(trend("concurrent", crit({ recouvrement: 1, exposition: 3, maturite: 3, capacite: 3, urgence: 3 }), [], false)!.label).toBe("Surveiller");
  });
});

describe("tendance détournement", () => {
  it("apporte fort, coûte faible → Adopter", () => {
    expect(trend("detournement", crit({ valeur: 5, ampleur: 4, effort: 1, risque: 2, urgence: 1 }), [], false)!.label).toBe("Adopter");
  });
  it("apporte fort, coûte fort → Tolérer pour l'instant", () => {
    expect(trend("detournement", crit({ valeur: 5, ampleur: 4, effort: 4, risque: 4, urgence: 1 }), [], false)!.label).toBe(TRP);
  });
  it("catégorie partagée → Partagée", () => {
    expect(trend("detournement", crit({ valeur: 3, ampleur: 3, effort: 1, risque: 1, urgence: 1 }), [], false)!.label).toBe(PART);
  });
  it("risque bloquant → Corriger", () => {
    expect(trend("detournement", crit({ valeur: 5, ampleur: 5, effort: 1, risque: 1, urgence: 1 }), [], true)!.label).toBe("Corriger");
  });
});

describe("solidité de l'attaque", () => {
  it("2 étayées solide, 1 partielle, 0 fragile", () => {
    const a = { ...base(), objections: [obj({ support: "etayee" }), obj({ support: "etayee" }), obj({ option: "Riposter", support: "etayee" })] };
    expect(solidity(a, "Ajuster")).toBe("solide");
    expect(solidity(a, "Riposter")).toBe("partielle");
    expect(solidity(a, "Surveiller")).toBe("fragile");
  });
});

describe("issue", () => {
  it("échec sans objection utile et nouvelle", () => {
    const a = { ...base(), position: "Ajuster", decision: "Ajuster", objections: [obj({ useful: "oui", novel: "non" })] } as Analysis;
    expect(outcome(a)!.label).toBe("Échec");
  });
  it("succès fort si décision changée avec apport", () => {
    const a = { ...base(), position: "Surveiller", decision: "Ajuster", objections: [obj({ useful: "oui", novel: "oui" })] } as Analysis;
    expect(outcome(a)!.label).toBe("Succès fort");
  });
  it("décision construite sans position", () => {
    const a = { ...base(), position: NSP, decision: "Ajuster", objections: [obj({ useful: "oui", novel: "oui" })] } as Analysis;
    expect(outcome(a)!.label).toBe("Succès · décision construite");
  });
  it("non calculée tant qu'une objection reste à évaluer", () => {
    const a = { ...base(), position: "Ajuster", decision: "Ajuster", objections: [obj({ useful: "oui" })] } as Analysis;
    expect(outcome(a)).toBeNull();
  });
});

describe("décider", () => {
  it("justification obligatoire si écart avec l'IA, et revue + mesure", () => {
    const a = { ...base(), decision: "Riposter" } as Analysis;
    expect(decideErrors(a, "Ajuster")).toHaveLength(3);
    expect(decideErrors({ ...a, decisionWhy: "x", trigger: "y", measure: "z" }, "Ajuster")).toHaveLength(0);
  });
});

describe("statut (parcours en six étapes)", () => {
  const base = () => ({ ...newAnalysis("concurrent", "x", new Date()), launched: true });
  it("évaluation incomplète dès l'étape 6", () => {
    expect(status({ ...base(), step: 5, decision: "Surveiller" })).toBe("eval_incomplete");
  });
  it("décision non validée (étape 5) reste en cours", () => {
    expect(status({ ...base(), step: 4, decision: "Surveiller" })).toBe("en_cours");
  });
  it("évaluation périmée → bloquée", () => {
    expect(status({ ...base(), step: 2, staleEnjeu: true })).toBe("bloquee");
  });
});

describe("lancement d’une analyse", () => {
  it("réclame un nom et un type de situation", () => {
    expect(launchMissing("", null)).toEqual(["nom", "situation"]);
  });
  it("un nom seul laisse la situation à choisir", () => {
    expect(launchMissing("Camille", null)).toEqual(["situation"]);
  });
  it("un type seul laisse le nom à saisir", () => {
    expect(launchMissing("   ", "concurrent")).toEqual(["nom"]);
  });
  it("les deux choisies, rien ne manque", () => {
    expect(launchMissing("Camille", "detournement")).toEqual([]);
  });
});

describe("format des champs obligatoires", () => {
  it("un texte libre doit contenir des lettres", () => {
    expect(textFormatError("")).toBeNull();
    expect(textFormatError("12345")).toMatch(/chiffres/);
    expect(textFormatError("…  !")).toMatch(/mots/);
    expect(textFormatError("Bêta chez 2 concurrents")).toBeNull();
  });
  it("un nom n’a ni chiffres ni symboles", () => {
    expect(nameFormatError("Camille")).toBeNull();
    expect(nameFormatError("J.-P. O’Neil")).toBeNull();
    expect(nameFormatError("Camille2")).toMatch(/chiffres/);
    expect(nameFormatError("@cam")).toMatch(/lettres/);
    expect(launchMissing("42", "concurrent")).toEqual(["nom"]);
  });
  it("décrire et décider bloquent sur un champ fait de chiffres", () => {
    const a = { ...newAnalysis("concurrent", "x", new Date()), signal: "123", position: "Surveiller" } as Analysis;
    expect(describeErrors(a)).toEqual(["Signal concurrent : saisissez du texte, pas uniquement des chiffres."]);
    expect(decideErrors({ ...a, decision: "Ajuster", trigger: "y", measure: "10" }, "Ajuster")).toHaveLength(1);
  });
});

describe("recherche et filtres de l'historique", () => {
  const a1: Analysis = { ...newAnalysis("concurrent", "1", new Date("2026-01-01")), signal: "Bêta publique chez un concurrent" };
  const a2: Analysis = { ...newAnalysis("detournement", "2", new Date("2026-01-02")), observe: "Détournement de notre éditeur par un client" };
  const ids = (l: Analysis[]) => l.map((a) => a.id);
  it("sans filtre, les deux sont affichées", () => {
    expect(ids(filterAnalyses([a1, a2], NO_FILTER))).toEqual(["1", "2"]);
  });
  it("la recherche ignore les accents", () => {
    expect(ids(filterAnalyses([a1, a2], { ...NO_FILTER, q: "detournement" }))).toEqual(["2"]);
    expect(ids(filterAnalyses([a1, a2], { ...NO_FILTER, q: "Détournement" }))).toEqual(["2"]);
  });
  it("le filtre par type ne garde que ce type", () => {
    expect(ids(filterAnalyses([a1, a2], { ...NO_FILTER, kind: "concurrent" }))).toEqual(["1"]);
  });
  it("le filtre par statut ne garde que ce statut", () => {
    expect(filterAnalyses([a1, a2], { ...NO_FILTER, status: "en_cours" }).length).toBe(2);
    expect(filterAnalyses([a1, a2], { ...NO_FILTER, status: "evaluee" }).length).toBe(0);
  });
  it("tous les mots doivent se trouver", () => {
    expect(ids(filterAnalyses([a1, a2], { ...NO_FILTER, q: "concurrent beta" }))).toEqual(["1"]);
    expect(filterAnalyses([a1, a2], { ...NO_FILTER, q: "concurrent editeur" }).length).toBe(0);
  });
});
