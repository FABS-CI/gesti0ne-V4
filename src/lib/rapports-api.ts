import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type RapportFilters = {
  from?: string;
  to?: string;
  produits?: string[];
  niveaux?: string[];
  categories?: string[];
  types?: string[];
  villes?: string[];
  representants?: string[];
  statuts?: string[];
  client_id?: string;
};

export type ProduitLigneRapport = {
  produit_id: string;
  code: string | null;
  titre: string;
  niveau: string | null;
  categorie: string | null;
  prix_unitaire: number;
  qte_vendue: number;
  qte_facturee: number;
  nb_factures: number;
  nb_clients: number;
  ca: number;
  remises: number;
  ca_encaisse: number;
  reste_a_encaisser: number;
  qte_retournee: number;
  stock_actuel: number;
  stock_initial: number;
  stock_restant: number;
  pct_ca: number;
  rang: number;
};

export type RapportKpi = {
  qte_vendue: number;
  qte_facturee: number;
  nb_factures: number;
  nb_clients: number;
  ca: number;
  montant_facture?: number;
  montant_encaisse?: number;
  reste_a_encaisser?: number;
  taux_encaissement?: number;
  nb_commandes: number;
  prix_moyen: number;
  panier_moyen: number;
  top_produit: string | null;
  rentable_produit: string | null;
  flop_produit: string | null;
};

export type TopProduit = {
  produit_id: string;
  code: string | null;
  titre: string;
  niveau: string | null;
  categorie: string | null;
  qte_vendue: number;
  ca: number;
  nb_clients: number;
  nb_factures: number;
};

export type FlopReport = {
  jamais_vendus: { code: string; titre: string; niveau: string | null; categorie: string | null }[];
  peu_vendus: {
    code: string;
    titre: string;
    niveau: string | null;
    categorie: string | null;
    qte: number;
    ca: number;
  }[];
};

export type AgregatDim = {
  label: string;
  qte: number;
  ca: number;
  nb_clients: number;
  nb_factures: number;
  nb_produits: number;
};

export type ClientProduit = {
  client_id: string;
  client_nom: string;
  type_client: string | null;
  ville: string | null;
  qte: number;
  ca: number;
  nb_commandes: number;
  premiere: string;
  derniere: string;
};

export type SerieTemp = { periode: string; qte: number; ca: number; nb_commandes: number };

export async function getRapportProduits(
  filtres: RapportFilters,
  tri = "ca",
  sens: "asc" | "desc" = "desc",
  page = 1,
  pageSize = 50,
) {
  const { data, error } = await supabase.rpc("rapport_produits", {
    _filtres: filtres as unknown as Json,
    _tri: tri,
    _sens: sens,
    _limit: pageSize,
    _offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const r = (data ?? { total: 0, ca_total: 0, items: [] }) as unknown as {
    total: number;
    ca_total: number;
    items: ProduitLigneRapport[];
  };
  return { total: r.total ?? 0, ca_total: r.ca_total ?? 0, items: r.items ?? [] };
}

export async function getRapportKpi(filtres: RapportFilters) {
  const { data, error } = await supabase.rpc("rapport_kpi", {
    _filtres: filtres as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as RapportKpi;
}

export async function getRapportTopProduits(filtres: RapportFilters, limit = 20) {
  const { data, error } = await supabase.rpc("rapport_top_produits", {
    _filtres: filtres as unknown as Json,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TopProduit[];
}

export async function getRapportFlop(filtres: RapportFilters) {
  const { data, error } = await supabase.rpc("rapport_flop_produits", {
    _filtres: filtres as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as FlopReport;
}

export async function getRapportAgregat(
  filtres: RapportFilters,
  dim: "niveau" | "categorie" | "ville" | "quartier" | "type" | "representant",
) {
  const { data, error } = await supabase.rpc("rapport_agregat", {
    _filtres: filtres as unknown as Json,
    _dim: dim,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AgregatDim[];
}

export async function getRapportClientsProduit(
  produitId: string,
  filtres: RapportFilters,
  limit = 100,
) {
  const { data, error } = await supabase.rpc("rapport_clients_produit", {
    _produit_id: produitId,
    _filtres: filtres as unknown as Json,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ClientProduit[];
}

export async function getRapportEvolution(
  filtres: RapportFilters,
  granularite: "jour" | "semaine" | "mois" | "annee" = "mois",
) {
  const { data, error } = await supabase.rpc("rapport_evolution", {
    _filtres: filtres as unknown as Json,
    _granularite: granularite,
  });
  if (error) throw error;
  return (data ?? []) as unknown as SerieTemp[];
}

/**
 * Clé de normalisation identique à public.norm_key() côté base :
 * minuscules, sans accents/espaces/tirets, pluriel simple retiré.
 * Permet de fusionner « ABIDJAN / Abidjan », « college / colleges »…
 */
function normKey(v: string): string {
  const s = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return s.length > 3 && s.endsWith("s") ? s.slice(0, -1) : s;
}

/** Déduplique une liste de libellés sur leur clé normalisée (garde le 1er libellé lisible). */
function dedupeLabels(values: (string | null | undefined)[]): string[] {
  const map = new Map<string, string>();
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    const k = normKey(v);
    if (!k) continue;
    const prev = map.get(k);
    // Préfère un libellé « propre » (pas tout en majuscules) et le plus court
    if (!prev || (prev === prev.toUpperCase() && v !== v.toUpperCase()) || v.length < prev.length) {
      map.set(k, v);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Facettes filtres (produits, villes, représentants, types, niveaux, catégories, statuts). */
export async function getRapportFacets() {
  const [prod, fac] = await Promise.all([
    supabase
      .from("produits")
      .select("produit_id,titre,niveau,categorie")
      .eq("actif", true)
      .order("pin_order", { ascending: true })
      .order("niveau_ordre", { ascending: true })
      .order("titre", { ascending: true }),
    // Agrégat serveur : distincts calculés côté base
    supabase.rpc("clients_facets"),
  ]);
  if (prod.error) throw prod.error;
  if (fac.error) throw fac.error;
  const facets = (fac.data ?? { villes: [], representants: [], types: [] }) as {
    villes: string[];
    representants: string[];
    types: string[];
  };
  return {
    produits: (prod.data ?? []).map((p) => ({ id: p.produit_id, titre: p.titre })),
    niveaux: dedupeLabels((prod.data ?? []).map((p) => p.niveau)),
    categories: dedupeLabels((prod.data ?? []).map((p) => p.categorie)),
    villes: dedupeLabels(facets.villes ?? []),
    representants: dedupeLabels(facets.representants ?? []),
    types: dedupeLabels(facets.types ?? []),
    statuts: ["validee", "livree", "facturee"],
  };
}


/** Export Excel (XLSX) — respecte les colonnes/données fournies. */
export async function exportXlsx(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rapport");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
