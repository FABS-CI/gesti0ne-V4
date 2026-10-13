import { describe, it, expect } from "vitest";
import { formatPeriodeLabel, previousPeriode, matchPreset } from "../rapports-periode";
import { classifyNiveau, groupNiveaux } from "../rapports-niveaux";
import { rapportAnalyseSearchSchema } from "../rapports-search";

describe("libellé de période", () => {
  it("même mois", () => expect(formatPeriodeLabel("2026-10-01", "2026-10-13")).toBe("1 – 13 oct. 2026"));
  it("même jour", () => expect(formatPeriodeLabel("2026-10-13", "2026-10-13")).toBe("13 oct. 2026"));
  it("mois différents", () =>
    expect(formatPeriodeLabel("2026-09-28", "2026-10-13")).toBe("28 sept. – 13 oct. 2026"));
  it("années différentes", () =>
    expect(formatPeriodeLabel("2025-12-15", "2026-01-10")).toBe("15 déc. 2025 – 10 janv. 2026"));
  it("sans dates", () => expect(formatPeriodeLabel()).toBe("Toute la période"));
});

describe("période précédente", () => {
  it("même durée, juste avant", () =>
    expect(previousPeriode("2026-10-01", "2026-10-13")).toEqual({ from: "2026-09-18", to: "2026-09-30" }));
  it("un jour", () =>
    expect(previousPeriode("2026-03-01", "2026-03-01")).toEqual({ from: "2026-02-28", to: "2026-02-28" }));
});

describe("raccourci reconnu", () => {
  const now = new Date(Date.UTC(2026, 9, 13, 10));
  it("ce mois", () => expect(matchPreset("2026-10-01", "2026-10-13", now)).toBe("month"));
  it("personnalisé", () => expect(matchPreset("2026-10-02", "2026-10-13", now)).toBeNull());
});

describe("niveaux par cycle", () => {
  it("classe les libellés existants", () => {
    expect(classifyNiveau("PRIMAIRE - CE1").cycle).toBe("Primaire");
    expect(classifyNiveau("PREMIER CYCLE - 6ème-3ème").cycle).toBe("Collège");
    expect(classifyNiveau("Terminale").cycle).toBe("Lycée");
    expect(classifyNiveau("Grande Section").cycle).toBe("Maternelle");
    expect(classifyNiveau("ROMANS").cycle).toBe("Autres");
  });
  it("ordre pédagogique", () => {
    const g = groupNiveaux(["CM2", "CP1", "3ème", "6ème", "CE1", "Romans"]);
    expect(g.map((x) => x.cycle)).toEqual(["Primaire", "Collège", "Autres"]);
    expect(g[0].items).toEqual(["CP1", "CE1", "CM2"]);
    expect(g[1].items).toEqual(["6ème", "3ème"]);
  });
});

describe("comparaison dans l'adresse", () => {
  it("lue depuis l'URL", () => expect(rapportAnalyseSearchSchema.parse({ cmp: true }).cmp).toBe(true));
});
