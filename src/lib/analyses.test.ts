import { describe, expect, it } from "vitest";
import { newAnalysis, optionRobustness, status, suggestedOption, testErrors, reviewDueDate, describeErrors } from "./analyses";

const base = () => newAnalysis("concurrent", "a1", new Date("2026-01-01T00:00:00Z"));
const obj = (option: string, verdict?: "ecartee" | "a_traiter" | "bloquante") => ({ id: option + Math.random(), option, voice: "clients" as const, text: "x", verdict });

describe("règles Contre-feu", () => {
  it("une objection bloquante rend l'option à revoir", () => {
    const a = { ...base(), objections: [obj("Ajuster", "ecartee"), obj("Ajuster", "bloquante")] };
    expect(optionRobustness(a, "Ajuster")).toBe("a_revoir");
  });
  it("une objection à traiter donne une option avec ajustements", () => {
    const a = { ...base(), objections: [obj("Ajuster", "a_traiter")] };
    expect(optionRobustness(a, "Ajuster")).toBe("ajustements");
  });
  it("suggère l'option la plus solide", () => {
    const a = { ...base(), objections: [obj("Surveiller", "bloquante"), obj("Ajuster", "ecartee"), obj("Riposter", "a_traiter")] };
    expect(suggestedOption(a)).toBe("Ajuster");
  });
  it("exige une objection par option avant l'évaluation", () => {
    const a = { ...base(), objections: [obj("Surveiller")] };
    expect(testErrors(a)).toHaveLength(2);
  });
  it("la revue est due 30 jours après la décision", () => {
    expect(reviewDueDate(new Date("2026-01-01T00:00:00Z")).slice(0, 10)).toBe("2026-01-31");
  });
  it("une analyse terminée passe en revue à faire à l'échéance", () => {
    const a = { ...base(), completedAt: "2026-01-01T00:00:00Z", reviewDue: "2026-01-31T00:00:00Z" };
    expect(status(a, new Date("2026-01-15"))).toBe("terminee");
    expect(status(a, new Date("2026-02-01"))).toBe("revue_a_faire");
  });
  it("refuse une description non anonymisée", () => {
    const a = { ...base(), title: "T", signal: "un signal suffisamment long", startPosition: "Ajuster", startReason: "r" };
    expect(describeErrors(a)).toEqual(["Confirmez que la description est anonymisée."]);
  });
});
