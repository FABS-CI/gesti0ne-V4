import { describe, it, expect } from "vitest";
import { CHAMPS_REGIME, champsDuRegime, changementsRegime, erreurBareme, erreurChamp, valeurChamp } from "./regime-form";

const champ = (cle: string) => CHAMPS_REGIME.find((c) => c.cle === cle)!;

describe("paramètres des régimes de paie", () => {
  it("ITS forfaitaire et CN seulement pour 2022, réduction demi-part seulement pour 2024", () => {
    const c24 = champsDuRegime("REGIME_2024").map((c) => c.cle);
    const c22 = champsDuRegime("REGIME_2022").map((c) => c.cle);
    expect(c24).toContain("ricf_par_demi_part");
    expect(c24).not.toContain("its_taux_forfait");
    expect(c22).toContain("its_taux_forfait");
    expect(c22).toContain("cn_abattement");
    expect(c22).not.toContain("ricf_par_demi_part");
  });

  it("ancienneté par défaut : 1 % par an, 25 % maximum, 30 jours", () => {
    expect(valeurChamp({}, "anciennete_taux_par_an")).toBe(1);
    expect(valeurChamp({}, "anciennete_plafond")).toBe(25);
    expect(valeurChamp({}, "jours_mois")).toBe(30);
    expect(valeurChamp({ cmu_salarie: 500 }, "cmu_salarie")).toBe(500);
  });

  it("refuse un taux au-delà de 100 % ou négatif, accepte 6,3 %", () => {
    expect(erreurChamp(champ("cr_taux"), 101)).not.toBeNull();
    expect(erreurChamp(champ("cr_taux"), -1)).not.toBeNull();
    expect(erreurChamp(champ("cr_taux"), 6.3)).toBeNull();
    expect(erreurChamp(champ("cr_plafond"), 3375000)).toBeNull();
  });

  it("refuse un arrondi à 0", () => {
    expect(erreurChamp(champ("arrondi_unite"), 0)).not.toBeNull();
    expect(erreurChamp(champ("arrondi_unite"), 5)).toBeNull();
  });

  it("barème : plafonds croissants, dernière tranche ouverte", () => {
    expect(erreurBareme([[75000, 0], [240000, 16], [null, 32]])).toBeNull();
    expect(erreurBareme([[240000, 16], [75000, 0]])).not.toBeNull();
    expect(erreurBareme([[null, 0], [75000, 16]])).not.toBeNull();
    expect(erreurBareme([[75000, 120]])).not.toBeNull();
  });

  it("n'envoie que les valeurs modifiées", () => {
    expect(changementsRegime({ cr_taux: 6.3, cmu_salarie: 500 }, { cr_taux: 6.3, cmu_salarie: 1000 })).toEqual({ cmu_salarie: 1000 });
    expect(changementsRegime({ its_bareme: [[1, 0]] }, { its_bareme: [[1, 0]] })).toEqual({});
  });
});
