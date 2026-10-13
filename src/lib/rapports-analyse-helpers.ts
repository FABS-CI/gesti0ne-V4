import {
  getRapportProduits,
  type ProduitLigneRapport,
  type RapportFilters,
} from "@/lib/rapports-api";

export const EXPORT_BATCH = 500;

/** Charge tous les produits filtrés par lots de 500, pour un export complet. */
export async function fetchAllProduitsRapport(
  filters: RapportFilters,
  tri: string,
  sens: "asc" | "desc",
  onProgress?: (loaded: number, total: number) => void,
): Promise<ProduitLigneRapport[]> {
  const all: ProduitLigneRapport[] = [];
  let page = 1;
  let total = 0;
  do {
    const r = await getRapportProduits(filters, tri, sens, page, EXPORT_BATCH);
    total = r.total;
    all.push(...r.items);
    onProgress?.(all.length, total);
    if (r.items.length < EXPORT_BATCH) break;
    page += 1;
  } while (all.length < total);
  return all;
}

export const PRODUITS_HEADERS = [
  "Code",
  "Désignation",
  "Niveau",
  "Catégorie",
  "PU",
  "Qté vendue",
  "Qté facturée",
  "Nb factures",
  "Nb clients",
  "CA facturé",
  "CA encaissé",
  "Reste à encaisser",
  "Remises",
  "Retours",
  "Stock actuel",
  "Stock initial",
  "Stock restant",
  "% CA",
  "Rang",
];

export const PRODUITS_COLUMNS: Array<[string, string]> = [
  ["code", "Code"],
  ["titre", "Désignation"],
  ["", "Niveau"],
  ["", "Catégorie"],
  ["", "PU"],
  ["qte", "Qté vendue"],
  ["", "Qté fact."],
  ["", "Nb fact."],
  ["", "Nb clients"],
  ["ca", "CA facturé"],
  ["encaisse", "CA encaissé"],
  ["", "Reste à encaisser"],
  ["", "Remises"],
  ["", "Retours"],
  ["stock", "Stock actuel"],
  ["", "Stock init."],
  ["", "Stock rest."],
  ["", "% CA"],
  ["", "Rang"],
];

export function produitsRowsForExport(rows: ProduitLigneRapport[]) {
  return rows.map((r) => [
    r.code ?? "",
    r.titre,
    r.niveau ?? "",
    r.categorie ?? "",
    r.prix_unitaire,
    r.qte_vendue,
    r.qte_facturee,
    r.nb_factures,
    r.nb_clients,
    r.ca,
    r.ca_encaisse ?? 0,
    r.reste_a_encaisser ?? 0,
    r.remises,
    r.qte_retournee,
    r.stock_actuel,
    r.stock_initial,
    r.stock_restant,
    r.pct_ca,
    r.rang,
  ]);
}
