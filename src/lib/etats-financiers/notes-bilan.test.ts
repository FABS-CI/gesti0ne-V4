// Recoupement des notes annexes avec le bilan et le compte de résultat : une note
// et le poste qu'elle détaille sont calculés sur les mêmes comptes.

import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerNotes } from "@/lib/etats-financiers/notes";

const solde = (compte: string, s: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(s, 0),
  credit: Math.max(-s, 0),
  solde: s,
});

// Au moins un compte par ligne de note, plus quelques comptes non ventilés.
const BALANCE: BalanceRow[] = [
  // Immobilisations financières
  solde("2611", 1000),
  solde("2711", 200),
  solde("2751", 300),
  solde("2961", -100),
  solde("2971", -50),
  // HAO
  solde("4851", 400),
  solde("4881", 100),
  solde("4981", -20),
  // Stocks
  solde("3111", 5000),
  solde("3211", 700),
  solde("3911", -300),
  // Autres créances (débiteurs) et autres dettes (créditeurs)
  solde("4211", 60),
  solde("4311", 70),
  solde("4451", 80),
  solde("4711", 90),
  solde("4761", 15),
  solde("1851", 25),
  solde("4951", -10),
  solde("4621", -900),
  solde("4651", -100),
  solde("4719", -55),
  solde("4771", -35),
  solde("4721", -5),
  solde("4991", -12),
  // Titres de placement, valeurs à encaisser
  solde("5011", 500),
  solde("5901", -40),
  solde("5111", 120),
  solde("5131", 30),
  solde("5911", -5),
  // Capitaux propres
  solde("1051", -1000),
  solde("1111", -500),
  solde("1131", -200),
  solde("1181", -300),
  solde("1211", -150),
  solde("1411", -800),
  solde("1511", -60),
  solde("1571", -40),
  // Dettes financières
  solde("1621", -2000),
  solde("1661", -30),
  solde("1811", -100),
  solde("1731", -400),
  solde("1911", -70),
  solde("1981", -15),
  // Trésorerie
  solde("5641", -300),
  solde("5211", 1000),
  solde("5221", -200),
  solde("5611", -400),
  // Charges et produits
  solde("6611", 3000),
  solde("6641", 500),
  solde("6711", 200),
  solde("6781", 10),
  solde("7711", -40),
  solde("7761", -60),
];

const ef = calculerEtatsFinanciers(BALANCE, BALANCE);
const notes = calculerNotes(BALANCE, BALANCE);
const ligne = (numero: string, libelle: string) => {
  const l = notes.find((n) => n.numero === numero)?.lignes.find((x) => x.libelle === libelle);
  if (!l) throw new Error(`NOTE ${numero} : ligne « ${libelle} » absente`);
  return l.montant;
};

describe("notes annexes ↔ bilan et compte de résultat", () => {
  it("note 4 : immobilisations financières (AR + AS)", () => {
    expect(ligne("4", "TOTAL BRUT")).toBe(ef.actif.AR.brut + ef.actif.AS.brut);
    expect(ligne("4", "TOTAL NET DE DEPRECIATION")).toBe(ef.actif.AQ.net);
    expect(ligne("4", "Dépréciations des titres de participation")).toBe(-100);
  });

  it("notes 5, 6 : HAO (BA) et stocks (BB)", () => {
    expect(ligne("5", "TOTAL BRUT")).toBe(ef.actif.BA.brut);
    expect(ligne("5", "TOTAL NET DE DEPRECIATIONS")).toBe(ef.actif.BA.net);
    expect(ligne("6", "TOTAL BRUT STOCKS ET EN COURS")).toBe(ef.actif.BB.brut);
    expect(ligne("6", "TOTAL NET DE DEPRECIATIONS")).toBe(ef.actif.BB.net);
  });

  it("note 8 : autres créances (BJ)", () => {
    expect(ligne("8", "TOTAL BRUT AUTRES CREANCES")).toBe(ef.actif.BJ.brut);
    expect(ligne("8", "TOTAL NET DE DEPRECIATIONS")).toBe(ef.actif.BJ.net);
  });

  it("notes 9, 10 : titres de placement (BQ), valeurs à encaisser (BR, dépréciation 591)", () => {
    expect(ligne("9", "TOTAL NET DE DEPRECIATIONS")).toBe(ef.actif.BQ.net);
    expect(ligne("10", "TOTAL BRUT VALEURS A ENCAISSER")).toBe(ef.actif.BR.brut);
    expect(ligne("10", "TOTAL NET DE DEPRECIATIONS")).toBe(ef.actif.BR.net);
    expect(ef.actif.BR.amort).toBe(5);
  });

  it("notes 14, 15A : primes, réserves, subventions, provisions réglementées", () => {
    expect(ligne("14", "TOTAL PRIMES")).toBe(ef.passif.CD);
    expect(ligne("14", "TOTAL RESERVES INDISPONIBLES")).toBe(ef.passif.CF);
    expect(ligne("14", "Réserves libres")).toBe(ef.passif.CG);
    expect(ligne("14", "Report à nouveau")).toBe(150);
    expect(ligne("15A", "TOTAL SUBVENTIONS")).toBe(ef.passif.CL);
    expect(ligne("15A", "TOTAL PROVISIONS REGLEMENTEES")).toBe(ef.passif.CM);
  });

  it("note 16A : dettes financières (DA), location-acquisition (DB), provisions (DC)", () => {
    expect(ligne("16A", "TOTAL EMPRUNTS ET DETTES FINANCIERES")).toBe(ef.passif.DA);
    expect(ligne("16A", "TOTAL DETTES DE LOCATION ACQUISITION")).toBe(ef.passif.DB);
    expect(ligne("16A", "TOTAL PROVISIONS POUR RISQUES ET CHARGES")).toBe(ef.passif.DC);
  });

  it("note 19 : autres dettes (DM), compte 4721 non ventilé", () => {
    expect(ligne("19", "TOTAL AUTRES DETTES")).toBe(ef.passif.DM);
    const n19 = notes.find((n) => n.numero === "19")!;
    expect(n19.lignes).toContainEqual({
      libelle: "Autres comptes (non ventilé)",
      montant: 5,
      niveau: "detail",
    });
  });

  it("note 20 : banques et crédits (DQ, DR)", () => {
    expect(ligne("20", "TOTAL: BANQUES, CREDITS D'ESCOMPTE ET DE TRESORERIE")).toBe(ef.passif.DQ);
    expect(ligne("20", "TOTAL: BANQUES, CREDITS DE TRESORERIE")).toBe(ef.passif.DR);
  });

  it("notes 27A, 29 : personnel (RK), frais et revenus financiers (RM, TK)", () => {
    expect(ligne("27A", "TOTAL")).toBe(-ef.resultat.RK);
    expect(ligne("29", "SOUS TOTAL : FRAIS FINANCIERS (A)")).toBe(-ef.resultat.RM);
    expect(ligne("29", "SOUS TOTAL : REVENUS FINANCIERS (B)")).toBe(ef.resultat.TK);
  });

  it("dépréciations marquées comme déduites (reportées en positif dans la liasse)", () => {
    const dep = notes.flatMap((n) => n.lignes).filter((l) => l.deduite);
    expect(dep.length).toBeGreaterThanOrEqual(9);
    expect(dep.every((l) => l.montant <= 0)).toBe(true);
  });
});
