import { describe, it, expect } from "vitest";
import { computeRapportPeriode, todayInTimezone } from "../rapports-periode";
import { groupKey, groupLabels, titleCaseVille, cleanSpaces } from "../rapports-labels";
import {
  rapportAnalyseSearchSchema,
  searchToFilters,
  filtersToSearch,
} from "../rapports-search";

// Mardi 13 octobre 2026, 10 h UTC (= 10 h à Abidjan)
const mardi = new Date(Date.UTC(2026, 9, 13, 10));

describe("périodes du rapport (heure d'Abidjan)", () => {
  it("aujourd'hui et hier", () => {
    expect(computeRapportPeriode("today", mardi)).toEqual({ from: "2026-10-13", to: "2026-10-13" });
    expect(computeRapportPeriode("yesterday", mardi)).toEqual({ from: "2026-10-12", to: "2026-10-12" });
  });
  it("la semaine commence le lundi", () => {
    expect(computeRapportPeriode("week", mardi).from).toBe("2026-10-12");
    const dimanche = new Date(Date.UTC(2026, 9, 18, 12));
    expect(computeRapportPeriode("week", dimanche).from).toBe("2026-10-12");
    const lundi = new Date(Date.UTC(2026, 9, 12, 0, 30));
    expect(computeRapportPeriode("week", lundi).from).toBe("2026-10-12");
  });
  it("trimestre, année, 7 et 12 derniers mois", () => {
    expect(computeRapportPeriode("quarter", mardi).from).toBe("2026-10-01");
    expect(computeRapportPeriode("quarter", new Date(Date.UTC(2026, 4, 20))).from).toBe("2026-04-01");
    expect(computeRapportPeriode("year", mardi).from).toBe("2026-01-01");
    expect(computeRapportPeriode("7d", mardi).from).toBe("2026-10-07");
    expect(computeRapportPeriode("12m", mardi)).toEqual({ from: "2025-10-14", to: "2026-10-13" });
  });
  it("changement de mois : hier le 1er mars est le 28 février", () => {
    const premierMars = new Date(Date.UTC(2026, 2, 1, 8));
    expect(computeRapportPeriode("yesterday", premierMars).from).toBe("2026-02-28");
    expect(computeRapportPeriode("month", premierMars)).toEqual({ from: "2026-03-01", to: "2026-03-01" });
  });
  it("utilise le fuseau d'Abidjan, pas celui du poste", () => {
    // 23 h 30 à Abidjan = 31 déc. ; à Paris ce serait déjà le 1er janvier.
    expect(todayInTimezone(new Date(Date.UTC(2026, 11, 31, 23, 30)))).toEqual({ y: 2026, m: 12, d: 31 });
  });
});

describe("normalisation des libellés", () => {
  it("nettoie les espaces", () => expect(cleanSpaces("  GRAND   BASSAM ")).toBe("GRAND BASSAM"));
  it("casse Titre pour les villes", () => {
    expect(titleCaseVille("ABIDJAN")).toBe("Abidjan");
    expect(titleCaseVille("grand-bassam")).toBe("Grand-Bassam");
    expect(titleCaseVille("BOUNDIALI (GBON)")).toBe("Boundiali (Gbon)");
  });
  it("clé insensible aux accents et à la casse", () => {
    expect(groupKey("Séguéla ")).toBe(groupKey("SEGUELA"));
  });
  it("regroupe abidjan / ABIDJAN en gardant les deux valeurs d'origine", () => {
    const g = groupLabels(["abidjan", "ABIDJAN", "Bouaké"], titleCaseVille);
    expect(g).toHaveLength(2);
    expect(g[0]).toEqual({ key: "abidjan", label: "Abidjan", values: ["abidjan", "ABIDJAN"] });
  });
  it("ne fusionne pas les quasi-doublons orthographiques", () => {
    expect(groupLabels(["GRAND MORIE", "GRAND MORRIE"])).toHaveLength(2);
  });
});

describe("filtres dans l'adresse de la page", () => {
  it("aller-retour filtres ↔ URL", () => {
    const f = { from: "2026-10-01", to: "2026-10-13", niveaux: ["CE1", "CE2"] };
    expect(searchToFilters(rapportAnalyseSearchSchema.parse(filtersToSearch(f)))).toEqual(f);
  });
  it("ignore les valeurs invalides", () => {
    const s = rapportAnalyseSearchSchema.parse({ from: "hier", page: -3, onglet: "x", sens: "haut" });
    expect(s).toEqual({});
  });
});
