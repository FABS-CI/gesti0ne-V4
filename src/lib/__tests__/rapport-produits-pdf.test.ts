import { describe, it, expect } from "vitest";
import { rapportProduitsTotaux, rowCells, valeurStock } from "@/lib/pdf/rapport-produits-pdf";
import type { ProduitLigneRapport } from "@/lib/rapports-api";

const row = (o: Partial<ProduitLigneRapport>) => ({ code: "C", titre: "T", qte_vendue: 0, ca: 0, stock_actuel: 0, ...o }) as ProduitLigneRapport;

describe("PDF rapport produits", () => {
  it("9 colonnes", () => expect(rowCells(row({}))).toHaveLength(9));
  it("récap : prix d'achat = Σ qté × prix d'achat, stock = Σ stock actuel", () => {
    const t = rapportProduitsTotaux([
      row({ qte_vendue: 10, prix_achat: 500, ca: 9000, stock_actuel: 40 }),
      row({ qte_vendue: 3, prix_achat: 1000, ca: 4500, stock_actuel: 2 }),
    ]);
    expect(t).toEqual({ produits: 2, qte: 13, ca: 13500, achat: 8000, stock: 42, valeurStock: 0 });
  });
  it("valeur stock = stock × PU sans remise, total = somme", () => {
    const rows = [
      row({ code: "FABS-CI90", stock_actuel: 74169, prix_unitaire: 2000 }),
      row({ code: "FABS-CI06", stock_actuel: 357177, prix_unitaire: 2000 }),
      row({ code: "FABS-CI64", stock_actuel: 503, prix_unitaire: 2000 }),
      row({ code: "FABS-CI54", stock_actuel: 419, prix_unitaire: 3000 }),
    ];
    expect(valeurStock(rows[0])).toBe(148338000);
    expect(valeurStock(rows[1])).toBe(714354000);
    expect(rapportProduitsTotaux(rows).valeurStock).toBe(864955000);
  });
});
