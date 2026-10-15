import { describe, it, expect } from "vitest";
import { rapportProduitsTotaux, rowCells } from "@/lib/pdf/rapport-produits-pdf";
import type { ProduitLigneRapport } from "@/lib/rapports-api";

const row = (o: Partial<ProduitLigneRapport>) => ({ code: "C", titre: "T", qte_vendue: 0, ca: 0, stock_actuel: 0, ...o }) as ProduitLigneRapport;

describe("PDF rapport produits", () => {
  it("8 colonnes", () => expect(rowCells(row({}))).toHaveLength(8));
  it("récap : prix d'achat = Σ qté × prix d'achat, stock = Σ stock actuel", () => {
    const t = rapportProduitsTotaux([
      row({ qte_vendue: 10, prix_achat: 500, ca: 9000, stock_actuel: 40 }),
      row({ qte_vendue: 3, prix_achat: 1000, ca: 4500, stock_actuel: 2 }),
    ]);
    expect(t).toEqual({ produits: 2, qte: 13, ca: 13500, achat: 8000, stock: 42 });
  });
});
