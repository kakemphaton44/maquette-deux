import { describe, expect, it } from "vitest";
import { NSP, TRP, PART, newAnalysis, outcome, solidity, trend, decideErrors, type Analysis, type Criterion, type Objection } from "./analyses";

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
