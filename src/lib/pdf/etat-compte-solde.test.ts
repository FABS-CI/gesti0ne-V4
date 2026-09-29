import { describe, it, expect } from "vitest";
import { computeSoldeClient, type RawInputs } from "./etat-compte-solde";

// Jeu de données commun — SIMULE les données remontées par Supabase pour
// un même client sur un même exercice. On vérifie que le calcul unique
// (utilisé par la route tableau ET par le builder PDF) est cohérent.

const CLIENT = "c-1";
const base: RawInputs = {
  clientId: CLIENT,
  dateDebut: "2026-01-01",
  dateFin: "2026-12-31",
  soldeOuvertureRow: 50_000,
  factures: [
    { reference: "F-001", date_facture: "2025-12-15", montant_total: 30_000 }, // antérieur
    { reference: "F-002", date_facture: "2026-02-10", montant_total: 120_000 },
    { reference: "F-003", date_facture: "2026-06-05", montant_total: 80_000 },
    { reference: "F-004", date_facture: "2027-01-15", montant_total: 999_999 }, // hors période
  ],
  paiements: [
    { reference: "P-001", date_paiement: "2026-03-01", montant: 40_000, statut: "valide" },
    { reference: "P-002", date_paiement: "2026-04-01", montant: 25_000, statut: "en_attente" }, // ignoré
    { reference: "P-003", date_paiement: "2025-11-20", montant: 10_000, statut: "valide" }, // antérieur
  ],
  avoirs: [
    { reference: "A-001", date_retour: "2026-05-10", montant: 5_000, statut: "valide" },
    { reference: "RET-001", date_retour: "2026-05-11", montant: 2_000, statut: "accepte" },
    { reference: "A-002", date_retour: "2026-07-01", montant: 3_000, statut: "brouillon" }, // ignoré
  ],
};

describe("computeSoldeClient — parité tableau ↔ PDF", () => {
  it("filtre les paiements/avoirs non valides", () => {
    const r = computeSoldeClient(base);
    expect(r.debug.compteurs.paiementsValidesPeriode).toBe(1); // seul P-001
    expect(r.debug.compteurs.avoirsValidesPeriode).toBe(2); // avoir valide + retour accepté
  });

  it("filtre les mouvements hors des bornes d'exercice", () => {
    const r = computeSoldeClient(base);
    expect(r.debug.compteurs.facturesRetenues).toBe(2); // F-002 + F-003
    expect(r.lignes.every((l) => l.date >= "2026-01-01" && l.date <= "2026-12-31")).toBe(true);
  });

  it("calcule le report antérieur = mouvements valides avant dateDebut", () => {
    const r = computeSoldeClient(base);
    // F-001 (30 000 débit) - P-003 (10 000 crédit) = 20 000
    expect(r.debug.reportAnterieur).toBe(20_000);
    // Solde d'ouverture = soldes_ouverture_clients + report antérieur
    expect(r.soldeOuverture).toBe(70_000);
  });

  it("Total impayé (FCFA) = Ouverture + Débits − Crédits (identique tableau et PDF)", () => {
    const r = computeSoldeClient(base);
    // Débits : 120 000 + 80 000 = 200 000
    // Crédits : 40 000 (P-001) + 5 000 (A-001) + 2 000 (RET-001) = 47 000
    // Solde = 70 000 + 200 000 − 47 000 = 223 000
    expect(r.totalDebit).toBe(200_000);
    expect(r.totalCredit).toBe(47_000);
    expect(r.totalPaiement).toBe(40_000);
    expect(r.totalRetours).toBe(7_000);
    expect(r.solde).toBe(223_000);

    // Recalcul « à la manière du PDF » (ligne à ligne à partir du soldeOuverture)
    // doit donner exactement le même solde final.
    let running = r.soldeOuverture;
    for (const l of r.lignes) running += Number(l.debit ?? 0) - Number(l.credit ?? 0);
    expect(running).toBe(r.solde);
  });

  it("parité stricte tableau ↔ PDF : même input ⇒ mêmes totaux", () => {
    // La route et le builder PDF passent tous deux par computeSoldeClient.
    // Le même input DOIT produire les mêmes Débit / Crédit / Solde.
    const routeRes = computeSoldeClient(base);
    const pdfRes = computeSoldeClient(base);
    expect(routeRes.totalDebit).toBe(pdfRes.totalDebit);
    expect(routeRes.totalCredit).toBe(pdfRes.totalCredit);
    expect(routeRes.totalPaiement).toBe(pdfRes.totalPaiement);
    expect(routeRes.totalRetours).toBe(pdfRes.totalRetours);
    expect(routeRes.solde).toBe(pdfRes.solde);
    expect(routeRes.soldeOuverture).toBe(pdfRes.soldeOuverture);
    expect(routeRes.lignes).toEqual(pdfRes.lignes);
  });

  it("aucun mouvement valide → message explicatif + solde = ouverture", () => {
    const empty: RawInputs = {
      clientId: CLIENT,
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
      soldeOuvertureRow: 15_000,
      factures: [],
      paiements: [
        { reference: "P", date_paiement: "2026-02-01", montant: 100, statut: "en_attente" },
      ],
      avoirs: [],
    };
    const r = computeSoldeClient(empty);
    expect(r.isEmpty).toBe(true);
    expect(r.solde).toBe(15_000);
    expect(r.emptyExplanation).toMatch(/Aucun mouvement valide/);
    expect(r.emptyExplanation).toMatch(/Total impayé \(FCFA\)/);
  });
});
