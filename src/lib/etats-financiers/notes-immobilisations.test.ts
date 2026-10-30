import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import {
  calculerNotesImmobilisations,
  type NoteTableau,
} from "@/lib/etats-financiers/notes-immobilisations";

const ligne = (compte: string, debit: number, credit: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit,
  credit,
  solde: debit - credit,
});
const solde = (compte: string, s: number) => ligne(compte, Math.max(s, 0), Math.max(-s, 0));

// Immobilisations d'EDITION FABS-CI en 2025 (liasse DGI, notes 3A et 3C).
const OUVERTURE = [
  solde("2441", 2_500_000),
  solde("28441", -1_562_500),
  solde("2451", 2_850_000),
  solde("28451", -2_850_000),
];
const PERIODE = [ligne("28441", 0, 250_000), ligne("6813", 250_000, 0)];
const CLOTURE = [
  solde("2441", 2_500_000),
  solde("28441", -1_812_500),
  solde("2451", 2_850_000),
  solde("28451", -2_850_000),
];

const donnees = {
  ouverture: OUVERTURE,
  periode: PERIODE,
  cumul: CLOTURE,
  ouvertureConnue: true,
  mouvementsConnus: true,
};

const ligneDe = (n: NoteTableau, libelle: string, niveau = "detail") =>
  n.lignes.find((l) => l.libelle === libelle && l.niveau === niveau)!.valeurs;
const note = (notes: NoteTableau[], numero: string) => notes.find((n) => n.numero === numero)!;

describe("notes 3 — immobilisations", () => {
  const notes = calculerNotesImmobilisations(donnees);

  it("3A : brut à l'ouverture et à la clôture, comme la liasse 2025", () => {
    const n = note(notes, "3A");
    expect(ligneDe(n, "Matériel, mobilier et actifs biologiques")).toMatchObject({
      ouverture: 2_500_000,
      acquisitions: 0,
      cessions: 0,
      cloture: 2_500_000,
      virements_plus: null,
      reevaluation: null,
    });
    expect(ligneDe(n, "Matériel de transport").cloture).toBe(2_850_000);
    expect(ligneDe(n, "TOTAL GENERAL", "general").cloture).toBe(5_350_000);
    // Aucun mouvement : pas d'hypothèse sur les virements.
    expect(n.hypotheses).toEqual([]);
  });

  it("3A recoupe le brut de l'actif immobilisé (mêmes règles que le bilan)", () => {
    const ef = calculerEtatsFinanciers(CLOTURE, []);
    const n = note(notes, "3A");
    expect(ligneDe(n, "IMMOBILISATIONS CORPORELLES", "total").cloture).toBe(ef.actif.AI.brut);
    expect(ligneDe(n, "Matériel de transport").cloture).toBe(ef.actif.AN.brut);
  });

  it("3C : ouverture, dotation et cumul de la liasse 2025", () => {
    const n = note(notes, "3C");
    expect(ligneDe(n, "Matériel, mobilier et actifs biologiques")).toMatchObject({
      ouverture: 1_562_500,
      dotations: 250_000,
      diminutions: 0,
      cloture: 1_812_500,
      reprises: null,
    });
    expect(ligneDe(n, "TOTAL GENERAL", "general").cloture).toBe(4_662_500);
    const ef = calculerEtatsFinanciers(CLOTURE, []);
    expect(ligneDe(n, "IMMOBILISATIONS CORPORELLES", "total").cloture).toBe(ef.actif.AI.amort);
  });

  it("3D : aucune cession, tout à zéro et cohérent avec les comptes 81 et 82", () => {
    const n = note(notes, "3D");
    expect(ligneDe(n, "TOTAL GENERAL", "general")).toMatchObject({
      brut: 0,
      amort: 0,
      vnc: 0,
      prix: 0,
      plus_value: 0,
    });
    expect(n.hypotheses).toEqual([]);
  });

  it("cession d'un véhicule : sortie en 3A et 3C, plus-value en 3D", () => {
    const periode = [
      ...PERIODE,
      ligne("2451", 0, 2_850_000),
      ligne("28451", 2_850_000, 0),
      ligne("8121", 0, 0),
      ligne("8221", 0, 400_000),
    ];
    const cumul = CLOTURE.filter((r) => !r.compte.startsWith("2") || !/451$/.test(r.compte));
    const ns = calculerNotesImmobilisations({ ...donnees, periode, cumul });
    expect(ligneDe(note(ns, "3A"), "Matériel de transport")).toMatchObject({
      ouverture: 2_850_000,
      cessions: 2_850_000,
      cloture: 0,
    });
    expect(note(ns, "3A").hypotheses[0]).toMatch(/virements de poste à poste/);
    expect(ligneDe(note(ns, "3C"), "Matériel de transport")).toMatchObject({
      diminutions: 2_850_000,
      cloture: 0,
    });
    const d = note(ns, "3D");
    expect(ligneDe(d, "Matériel de transport")).toMatchObject({
      brut: 2_850_000,
      amort: 2_850_000,
      vnc: 0,
    });
    expect(ligneDe(d, "IMMOBILISATIONS CORPORELLES", "total")).toMatchObject({
      prix: 400_000,
      plus_value: 400_000,
    });
    // VNC sortie = 0 = compte 812 : pas d'alerte.
    expect(d.hypotheses).toEqual([]);
  });

  it("VNC sortie différente du compte 81 : virement probable, signalé", () => {
    // 231 → 2441 : mise en service d'un bâtiment, pas une cession.
    const periode = [ligne("2311", 0, 1_000_000), ligne("2441", 1_000_000, 0)];
    const ns = calculerNotesImmobilisations({ ...donnees, periode });
    expect(note(ns, "3D").hypotheses.join(" ")).toMatch(/différente du compte 812/);
  });

  it("immeubles de placement non distingués : signalé, classés hors placement", () => {
    const ns = calculerNotesImmobilisations({
      ...donnees,
      cumul: [...CLOTURE, solde("2211", 5_000_000)],
    });
    const n = note(ns, "3A");
    expect(ligneDe(n, "Terrains hors immeuble de placement").cloture).toBe(5_000_000);
    expect(ligneDe(n, "Terrains - immeuble de placement").cloture).toBe(0);
    expect(n.hypotheses.join(" ")).toMatch(/immeubles de placement/);
  });

  it("balance importée sans mouvements : mouvements et totaux inconnus, jamais zéro", () => {
    const ns = calculerNotesImmobilisations({
      ...donnees,
      periode: [],
      ouvertureConnue: false,
      mouvementsConnus: false,
    });
    const n = note(ns, "3A");
    expect(ligneDe(n, "Matériel de transport")).toMatchObject({
      ouverture: null,
      acquisitions: null,
      cessions: null,
      cloture: 2_850_000,
    });
    expect(ligneDe(n, "TOTAL GENERAL", "general").acquisitions).toBeNull();
    expect(n.hypotheses.join(" ")).toMatch(/ouverture inconnus.*mouvements de l'exercice inconnus/);
    expect(ligneDe(note(ns, "3D"), "TOTAL GENERAL", "general").prix).toBeNull();
  });

  it("avances et acomptes : 251 incorporelles, 252 corporelles", () => {
    const ns = calculerNotesImmobilisations({
      ...donnees,
      cumul: [...CLOTURE, solde("2511", 100), solde("2521", 200)],
    });
    const n = note(ns, "3A");
    expect(ligneDe(n, "Avances et acomptes sur immobilisations incorporelles").cloture).toBe(100);
    expect(ligneDe(n, "Avances et acomptes sur immobilisations corporelles").cloture).toBe(200);
  });
});
