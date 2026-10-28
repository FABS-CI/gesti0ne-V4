import { describe, expect, it } from "vitest";
import type { Achat } from "@/lib/achats-api";
import { buildAchatPdfData } from "./achat-pdf-data";

const achat = {
  achat_id: "a1",
  reference: "APP-2026-00002",
  date_achat: "2026-07-31",
  montant: 6570000,
  notes: null,
  reference_fournisseur: null,
  fournisseurs: { raison_sociale: "ÉDITIONS SUPERNOVA", ville: "Abidjan", telephone: "(+225) 057 457 9999" },
} as unknown as Achat;

// Cas du bon APP-2026-00002 : 4 380 × 3 000 avec 50 % de remise sur la ligne.
const ligne = {
  reference_produit: "FABS-CI52",
  designation: "Manuel EPS FABS-CI Supernova 3 iem",
  quantite: 4380,
  prix_unitaire: 3000,
  remise_pct: 50,
  total_ligne: 6570000,
};

describe("Bon de réception (approvisionnement)", () => {
  it("affiche le sous-total brut, la remise sur lignes et le net", () => {
    const d = buildAchatPdfData(achat, [ligne]);
    expect(d.totalVente).toBe(13140000);
    expect(d.remiseLigneTotal).toBe(6570000);
    expect(d.remisePct).toBe(50);
    expect(d.totalTTC).toBe(6570000);
    expect(d.lignes?.[0]).toMatchObject({ qte: 4380, prixUnitaire: 3000, remisePct: 50, montant: 6570000 });
  });

  it("sans remise : aucune remise transmise, sous-total = net", () => {
    const d = buildAchatPdfData(achat, [{ ...ligne, remise_pct: 0, total_ligne: 13140000 }]);
    expect(d.remiseLigneTotal).toBe(0);
    expect(d.totalVente).toBe(13140000);
    expect(d.totalTTC).toBe(13140000);
  });

  it("reprend le fournisseur et la référence du bon", () => {
    const d = buildAchatPdfData(achat, [ligne]);
    expect(d.reference).toBe("APP-2026-00002");
    expect(d.clientNom).toBe("ÉDITIONS SUPERNOVA");
    expect(d.br_id).toBe("a1");
  });
});
