import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerNotes, type NoteCalculee } from "@/lib/etats-financiers/notes";

const ligne = (compte: string, solde: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

const note = (notes: NoteCalculee[], numero: string) => notes.find((n) => n.numero === numero)!;
const montant = (n: NoteCalculee, libelle: string) =>
  n.lignes.find((l) => l.libelle === libelle)?.montant;

// Sous-comptes reconstitués à partir des notes de la liasse 2025 d'EDITION FABS-CI.
const CUMUL_2025 = [
  ligne("4111", 53_781_256),
  ligne("4011", -12_856_500),
  ligne("4311", -1_247_649),
  ligne("4331", -36_000),
  ligne("4411", -17_662_472),
  ligne("4421", -261_087),
  ligne("4471", -170_912),
  ligne("5211", 54_582_218),
  ligne("5711", 12_757_025),
];
const PERIODE_2025 = [
  ligne("7011", -515_053_551),
  ligne("6011", 410_742_724),
  ligne("6051", 557_800),
  ligne("6052", 1_782_000),
  ligne("6053", 3_958_500),
  ligne("6054", 55_000),
  ligne("6055", 643_800),
  ligne("6056", 725_800),
  ligne("6057", 1_975_500),
  ligne("6161", 1_250_000),
  ligne("6183", 998_500),
  ligne("6222", 960_000),
  ligne("6241", 2_376_400),
  ligne("6251", 395_650),
  ligne("6281", 2_273_500),
  ligne("6381", 750_000),
  ligne("6411", 2_894_023),
];

describe("calculerNotes — liasse 2025 EDITION FABS-CI", () => {
  const notes = calculerNotes(CUMUL_2025, PERIODE_2025);

  it("note 7 : clients", () => {
    const n = note(notes, "7");
    expect(montant(n, "Clients (hors réserves de propriété et groupe)")).toBe(53_781_256);
    expect(montant(n, "TOTAL BRUT CLIENTS")).toBe(53_781_256);
    expect(montant(n, "TOTAL NET DE DÉPRÉCIATIONS")).toBe(53_781_256);
  });

  it("note 11 : disponibilités", () => {
    const n = note(notes, "11");
    expect(montant(n, "Banques locales")).toBe(54_582_218);
    expect(montant(n, "Caisse")).toBe(12_757_025);
    expect(montant(n, "TOTAL BRUT DISPONIBILITÉS")).toBe(67_339_243);
  });

  it("note 18 : dettes fiscales et sociales", () => {
    const n = note(notes, "18");
    expect(montant(n, "TOTAL DETTES SOCIALES")).toBe(1_283_649);
    expect(montant(n, "État, impôts sur les bénéfices")).toBe(17_662_472);
    expect(montant(n, "TOTAL DETTES FISCALES")).toBe(18_094_471);
    expect(montant(n, "TOTAL DETTES SOCIALES ET FISCALES")).toBe(19_378_120);
  });

  it("notes 21 à 25 : produits et charges", () => {
    expect(montant(note(notes, "21"), "TOTAL : CHIFFRE D'AFFAIRES")).toBe(515_053_551);
    expect(montant(note(notes, "22"), "TOTAL : ACHATS DE MARCHANDISES")).toBe(410_742_724);
    expect(montant(note(notes, "22"), "Autres énergies")).toBe(3_958_500);
    expect(montant(note(notes, "22"), "TOTAL : AUTRES ACHATS")).toBe(9_698_400);
    expect(montant(note(notes, "23"), "Transports de plis")).toBe(1_250_000);
    expect(montant(note(notes, "23"), "TOTAL")).toBe(2_248_500);
    expect(montant(note(notes, "24"), "Entretien, réparations et maintenance")).toBe(2_376_400);
    expect(montant(note(notes, "24"), "TOTAL")).toBe(6_755_550);
    expect(montant(note(notes, "25"), "TOTAL")).toBe(2_894_023);
  });

  it("aucune ligne « non ventilé » quand tous les sous-comptes sont prévus", () => {
    for (const n of notes)
      expect(n.lignes.filter((l) => l.libelle === "Autres comptes (non ventilé)")).toEqual([]);
  });
});

describe("calculerNotes — règles", () => {
  it("un sous-compte imprévu va en « non ventilé » sans changer le total", () => {
    const n = note(calculerNotes([], [ligne("6059", 100), ligne("6051", 50)]), "22");
    expect(montant(n, "Autres comptes (non ventilé)")).toBe(100);
    expect(montant(n, "TOTAL : AUTRES ACHATS")).toBe(150);
  });

  it("client créditeur : dans les clients créditeurs, pas dans le brut", () => {
    const n = note(
      calculerNotes([ligne("4111", 300), ligne("4112", -80), ligne("4191", -50)], []),
      "7",
    );
    expect(montant(n, "TOTAL BRUT CLIENTS")).toBe(300);
    expect(montant(n, "Clients, avances reçues")).toBe(50);
    expect(montant(n, "Autres clients créditeurs")).toBe(80);
    expect(montant(n, "TOTAL CLIENTS CRÉDITEURS")).toBe(130);
  });

  it("dépréciations clients déduites du brut", () => {
    const n = note(calculerNotes([ligne("4161", 1_000), ligne("4911", -400)], []), "7");
    expect(montant(n, "Créances litigieuses ou douteuses")).toBe(1_000);
    expect(montant(n, "Dépréciations des comptes clients")).toBe(-400);
    expect(montant(n, "TOTAL NET DE DÉPRÉCIATIONS")).toBe(600);
  });
});
