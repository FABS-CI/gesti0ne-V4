import { describe, expect, it } from "vitest";
import { computeSoldeClient, type RawInputs } from "./etat-compte-solde";
import { hasStatementReturns } from "./statement-returns";

const base: RawInputs = {
  clientId: "test-client",
  dateDebut: "2026-01-01",
  dateFin: "2026-12-31",
  factures: [{ reference: "FAC-1", date_facture: "2026-02-01", montant_total: 100_000 }],
  paiements: [{ reference: "PAY-1", date_paiement: "2026-02-02", montant: 20_000, statut: "valide" }],
  avoirs: [],
};

describe("retours admissibles dans le relevé PDF", () => {
  it("client sans retour : aucun retour à afficher, paiements et solde inchangés", () => {
    const result = computeSoldeClient(base);
    expect(hasStatementReturns(result.lignes)).toBe(false);
    expect(result.totalPaiement).toBe(20_000);
    expect(result.solde).toBe(80_000);
  });

  it("un retour validé : retour réel affichable, montant et solde inchangés", () => {
    const result = computeSoldeClient({ ...base, avoirs: [
      { reference: "RET-1", date_retour: "2026-02-03", montant: 5_000, statut: "valide_compta" },
    ] });
    expect(hasStatementReturns(result.lignes)).toBe(true);
    expect(result.lignes.filter((l) => l.type === "Avoir").map((l) => l.credit)).toEqual([5_000]);
    expect(result.totalRetours).toBe(5_000);
    expect(result.solde).toBe(75_000);
  });

  it("retours en attente, réceptionnés ou refusés : aucune opération financière admissible", () => {
    const result = computeSoldeClient({ ...base, avoirs:
      ["brouillon", "en_attente", "receptionne", "refus_magasin", "refus_compta"].map((statut) => ({
        reference: `RET-${statut}`, date_retour: "2026-02-03", montant: 5_000, statut,
      })),
    });
    expect(hasStatementReturns(result.lignes)).toBe(false);
    expect(result.totalRetours).toBe(0);
    expect(result.solde).toBe(80_000);
  });

  it("plusieurs retours : conserve toutes les opérations admissibles et leur total exact", () => {
    const result = computeSoldeClient({ ...base, avoirs: [
      { reference: "RET-1", date_retour: "2026-02-03", montant: 5_000, statut: "valide_compta" },
      { reference: "RET-2", date_retour: "2026-02-04", montant: 7_000, statut: "cloture" },
      { reference: "RET-3", date_retour: "2026-02-05", montant: 9_000, statut: "en_attente" },
    ] });
    expect(hasStatementReturns(result.lignes)).toBe(true);
    expect(result.lignes.filter((l) => l.type === "Avoir").map((l) => l.credit)).toEqual([5_000, 7_000]);
    expect(result.totalRetours).toBe(12_000);
    expect(result.solde).toBe(68_000);
  });

  it("montant nul, vide, zéro ou non fini : ne constitue jamais un vrai retour", () => {
    for (const credit of [undefined, null, "", 0, NaN, Infinity]) {
      expect(hasStatementReturns([{ date: "2026-02-03", reference: "RET-0", type: "Avoir", credit } as never])).toBe(false);
    }
  });

  it("retour validé hors période : ne déclenche pas la présence des retours", () => {
    const result = computeSoldeClient({ ...base, avoirs: [
      { reference: "RET-2027", date_retour: "2027-02-03", montant: 5_000, statut: "valide_compta" },
    ] });
    expect(hasStatementReturns(result.lignes)).toBe(false);
    expect(result.totalRetours).toBe(0);
  });
});