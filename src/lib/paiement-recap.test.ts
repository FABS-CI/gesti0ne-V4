import { describe, expect, it } from "vitest";
import {
  COMPARATIF_LS_KEY,
  computeRecap,
  loadComparatifState,
  repartirMontantRecu,
  saveComparatifState,
  validatePaiement,
} from "./paiement-recap";

describe("computeRecap", () => {
  it("impute la totalité quand montant < solde", () => {
    expect(computeRecap("F1", 100_000, 40_000)).toEqual({
      reference: "F1",
      reste_avant: 100_000,
      montant_impute: 40_000,
      reste_apres: 60_000,
    });
  });
  it("plafonne l'imputation au solde", () => {
    expect(computeRecap("F1", 50_000, 80_000).montant_impute).toBe(50_000);
    expect(computeRecap("F1", 50_000, 80_000).reste_apres).toBe(0);
  });
  it("gère un montant négatif", () => {
    expect(computeRecap("F1", 50_000, -10).montant_impute).toBe(0);
  });
  it("solde nul → aucune imputation", () => {
    expect(computeRecap("F1", 0, 10_000).reste_apres).toBe(0);
  });
});

describe("repartirMontantRecu", () => {
  const factures = [
    { facture_id: "F1", solde: 70_000 },
    { facture_id: "F2", solde: 100_000 },
  ];

  it("réajuste une facture au montant partiel reçu", () => {
    expect(repartirMontantRecu(30_000, [factures[0]])).toEqual({ F1: 30_000 });
  });

  it("répartit le paiement sur plusieurs factures sans dépasser leurs soldes", () => {
    expect(repartirMontantRecu(120_000, factures)).toEqual({ F1: 70_000, F2: 50_000 });
  });

  it("laisse le surplus non affecté quand le montant dépasse tous les soldes", () => {
    expect(repartirMontantRecu(200_000, factures)).toEqual({ F1: 70_000, F2: 100_000 });
  });

  it("ramène toutes les affectations à zéro pour un montant nul", () => {
    expect(repartirMontantRecu(0, factures)).toEqual({ F1: 0, F2: 0 });
  });
});

describe("validatePaiement", () => {
  const base = { montant: 1000, mode_paiement: "especes", reference_paiement: "REF-1" };
  it("passe avec des valeurs valides", () => {
    expect(validatePaiement(base)).toEqual({ ok: true });
  });
  it("rejette montant ≤ 0", () => {
    const r = validatePaiement({ ...base, montant: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejette référence vide", () => {
    const r = validatePaiement({ ...base, reference_paiement: "  " });
    expect(r.ok).toBe(false);
  });
  it("rejette mode de paiement absent", () => {
    const r = validatePaiement({ ...base, mode_paiement: "" });
    expect(r.ok).toBe(false);
  });
  it("rejette montant > solde", () => {
    const r = validatePaiement({ ...base, montant: 5000, solde: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/solde/i);
  });
});

describe("comparatif localStorage persistence", () => {
  function memStorage() {
    const store: Record<string, string> = {};
    return {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
  }
  it("sauvegarde puis restaure l'état", () => {
    const s = memStorage();
    saveComparatifState(s, { sort: "ca", dir: "desc", pct: false, exos: "a,b" });
    expect(loadComparatifState(s)).toEqual({
      sort: "ca",
      dir: "desc",
      pct: false,
      exos: "a,b",
    });
  });
  it("retourne null si vide", () => {
    expect(loadComparatifState(memStorage())).toBeNull();
  });
  it("utilise la clé versionnée attendue", () => {
    expect(COMPARATIF_LS_KEY).toBe("exercices-comparatif-state-v1");
  });
  it("ignore un JSON invalide sans crasher", () => {
    const s = memStorage();
    s.setItem(COMPARATIF_LS_KEY, "not-json{");
    expect(loadComparatifState(s)).toBeNull();
  });
});
