import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";
import { calculerNotes } from "@/lib/etats-financiers/notes";
import { SOLDES_2025 } from "@/lib/etats-financiers/fixtures-2025";
import {
  genererDossierPdf,
  montantPdf,
  nomFichierPdf,
  texteWinAnsi,
  type ParametresPdf,
} from "@/lib/etats-financiers/dossier-pdf";

const b: BalanceRow[] = SOLDES_2025.map(([compte, solde]) => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
}));
const ef = calculerEtatsFinanciers(b, b);
const n = {
  ...ef,
  tft: calculerTft(calculerEtatsFinanciers([], []), ef, b),
  notes: calculerNotes(b, b),
};

const params: ParametresPdf = {
  n,
  exercice: { date_debut: "2025-01-01", date_fin: "2025-12-31", libelle: "2025" },
  identite: { denomination: "EDITION FABS-CI", ncc: "2302562N", ntd: "123", adresse: "Abidjan" },
  controles: [{ niveau: "avertissement", code: "tva", message: "TVA a verifier" }],
  version: "Version 2",
};

// Texte des flux PDF (non compressés par défaut).
const texte = (p: ParametresPdf) => genererDossierPdf(p).output();

describe("dossier PDF", () => {
  it("toutes les sections, dans l'ordre de la liasse", () => {
    const t = texte(params);
    // Titres de page (opérateur Tj) ; le tiret long est codé sur un octet (WinAnsi).
    const positions = [
      "(ÉTATS FINANCIERS ANNUELS) Tj",
      "ACTIF) Tj",
      "PASSIF) Tj",
      "(COMPTE DE RÉSULTAT) Tj",
      "(TABLEAU DES FLUX DE TRÉSORERIE) Tj",
      "(NOTE ",
      "(CONTRÔLES DU DOSSIER) Tj",
    ].map((s) => t.indexOf(s));
    expect(positions.every((x) => x >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("montants de la liasse 2025 et identification sur les pages", () => {
    const t = texte(params);
    expect(t).toContain("121 807 999"); // total actif net (BZ)
    expect(t).toContain("34 187 413"); // résultat net
    expect(t).toContain("NCC : 2302562N");
    expect(t).toContain("Exercice clos le : 31/12/2025");
  });

  it("actif en paysage, pagination sur chaque page", () => {
    const doc = genererDossierPdf(params);
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(7);
    doc.setPage(2);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    doc.setPage(3);
    expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight());
    const t = doc.output();
    for (let i = 1; i <= pages; i++) expect(t).toContain(`Page ${i} / ${pages}`);
  });

  it("sans N-1 : colonne vide, jamais des zéros", () => {
    const t = genererDossierPdf(params, ["passif"]).output();
    expect(genererDossierPdf(params, ["passif"]).getNumberOfPages()).toBe(1);
    // Capital : 10 000 000 en N, rien en N-1.
    expect(t).toContain("10 000 000");
    expect(texte({ ...params, n1: n })).toContain("Exercice comparatif");
  });

  it("export d'un seul état", () => {
    const doc = genererDossierPdf(params, ["actif"]);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    expect(nomFichierPdf("2026")).toBe("ETATS_FINANCIERS_FABS_CI_2026.pdf");
    expect(nomFichierPdf("2026", "actif")).toBe("ETATS_FINANCIERS_FABS_CI_2026_ACTIF.pdf");
  });

  it("aucun texte en Unicode : les libellés du TFT (« − ») restent lisibles", () => {
    const t = texte(params);
    // Texte UTF-16 (marque FE FF) : jsPDF l'affiche lettre par lettre, déformé.
    expect(t.includes("(þÿ")).toBe(false);
    expect(t).toContain("(- Variation des stocks) Tj");
    expect(texteWinAnsi("Trésorerie N-1 − passif N")).toBe("Trésorerie N-1 - passif N");
    expect(texteWinAnsi("Résultat — 1 000 €")).toBe("Résultat — 1 000 €");
  });

  it("format des montants", () => {
    expect(montantPdf(1234567.4)).toBe("1 234 567");
    expect(montantPdf(-410742724)).toBe("(410 742 724)");
    expect(montantPdf(0)).toBe("-");
    expect(montantPdf(undefined)).toBe("");
  });
});
