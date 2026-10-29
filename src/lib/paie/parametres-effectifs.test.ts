import { describe, it, expect } from "vitest";
import { cleMoteurDe, CLES_MOTEUR, tranchesDe, valeurNumerique } from "./parametres-effectifs";

// Paramètres de REGIME_2024 tels que semés par la migration 0075 (+ 0082 pour l'arrondi).
const R2024 = {
  its_bareme: [
    [75000, 0],
    [240000, 16],
    [800000, 21],
    [2400000, 24],
    [8000000, 28],
    [null, 32],
  ],
  ricf_par_demi_part: 5500,
  cr_taux: 6.3,
  cr_plafond: 3375000,
  cmu_salarie: 500,
  cmu_patronal: 500,
  transport_plafond: 30000,
  arrondi_unite: 5,
  retraite_pat_taux: 7.7,
  retraite_pat_plafond: 3375000,
  pf_taux: 5,
  maternite_taux: 0.75,
  at_taux: 2,
  plafond_prestations: 70000,
  fdfp_actif: false,
  fdfp_taux: 0,
};

describe("cleMoteurDe — même correspondance que _paie_parametres_effectifs", () => {
  it("reconnaît les alias CNPS et CMU", () => {
    expect(cleMoteurDe("CNPS_SALARIE_RETRAITE", "6.3", R2024)).toBe("cr_taux");
    expect(cleMoteurDe("CNPS_PATRONAL_AT", "3", R2024)).toBe("at_taux");
    expect(cleMoteurDe("cmu_salarie", "500", R2024)).toBe("cmu_salarie");
  });
  it("reconnaît une clé du régime écrite en majuscules", () => {
    expect(cleMoteurDe("PLAFOND_PRESTATIONS", "75000", R2024)).toBe("plafond_prestations");
  });
  it("ignore les codes semés en juillet 2026 que le moteur ne lit pas", () => {
    // Valeurs affichées dans Paramètres Paie CI mais sans effet sur le calcul.
    for (const cle of [
      "CNPS_PATRONAL_PF",
      "CNPS_PLAFOND_MENSUEL",
      "CN_TAUX",
      "ITS_TRANCHE1_TAUX",
      "ABATTEMENT_ITS",
    ]) {
      expect(cleMoteurDe(cle, "1", R2024)).toBeNull();
    }
  });
  it("ignore une valeur non numérique, comme le moteur", () => {
    expect(cleMoteurDe("CMU_SALARIE", "1 000", R2024)).toBeNull();
    expect(cleMoteurDe("CMU_SALARIE", "", R2024)).toBeNull();
    expect(cleMoteurDe(null, "500", R2024)).toBeNull();
  });
  it("accepte les clés libres d'ancienneté et de jours positives seulement", () => {
    expect(cleMoteurDe("jours_mois", "30", R2024)).toBe("jours_mois");
    expect(cleMoteurDe("jours_mois", "-30", R2024)).toBeNull();
  });
});

describe("tranchesDe", () => {
  it("lit le barème ITS 2024 en tranches continues, sans trou ni chevauchement", () => {
    const t = tranchesDe(R2024.its_bareme);
    expect(t).toHaveLength(6);
    expect(t[0]).toEqual({ de: 0, a: 75000, taux: 0 });
    expect(t[1]).toEqual({ de: 75001, a: 240000, taux: 16 });
    expect(t.at(-1)).toEqual({ de: 8000001, a: null, taux: 32 });
    for (let i = 1; i < t.length; i++) expect(t[i].de).toBe((t[i - 1].a as number) + 1);
  });
  it("renvoie une liste vide pour un barème absent", () => {
    expect(tranchesDe(undefined)).toEqual([]);
  });
});

describe("valeurNumerique", () => {
  it("distingue un zéro légitime d'une valeur absente", () => {
    expect(valeurNumerique({ fdfp_taux: 0 }, "fdfp_taux")).toBe(0);
    expect(valeurNumerique({}, "cr_taux")).toBeNull();
    expect(valeurNumerique({ cr_taux: "6.3" }, "cr_taux")).toBeNull();
  });
});

describe("CLES_MOTEUR", () => {
  it("couvre chaque clé obligatoire du contrôle serveur (migration 0101)", () => {
    const cles = CLES_MOTEUR.map((c) => c.cle);
    for (const k of [
      "cr_taux",
      "retraite_pat_taux",
      "pf_taux",
      "at_taux",
      "cr_plafond",
      "retraite_pat_plafond",
      "plafond_prestations",
      "cmu_salarie",
      "cmu_patronal",
      "transport_plafond",
      "arrondi_unite",
    ]) {
      expect(cles).toContain(k);
    }
  });
});
