import { supabase } from "@/integrations/supabase/client";

export type VenteLigne = {
  ligne_id: string;
  commande_id: string;
  commande_reference: string | null;
  client_nom: string | null;
  date_commande: string | null;
  statut: string | null;
  quantite: number;
  prix_unitaire: number;
  total_ligne: number;
};

export async function getProduitVentes(produitId: string, limit = 50) {
  const { data, error } = await supabase
    .from("commande_lignes")
    .select(
      "ligne_id, commande_id, quantite, prix_unitaire, total_ligne, commandes!inner(reference, client_nom, date_commande, statut)",
    )
    .eq("produit_id", produitId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ligne_id: row.ligne_id,
    commande_id: row.commande_id,
    commande_reference: row.commandes?.reference ?? null,
    client_nom: row.commandes?.client_nom ?? null,
    date_commande: row.commandes?.date_commande ?? null,
    statut: row.commandes?.statut ?? null,
    quantite: Number(row.quantite ?? 0),
    prix_unitaire: Number(row.prix_unitaire ?? 0),
    total_ligne: Number(row.total_ligne ?? 0),
  })) as VenteLigne[];
}

export type ProduitStats = {
  ca30: number;
  ca90: number;
  qte30: number;
  qte90: number;
  marge30: number;
  margePct30: number;
  rotation90: number; // qty sold / current stock
};

export async function getProduitStats(
  produitId: string,
  prixAchat: number,
  stockCourant: number,
): Promise<ProduitStats> {
  const now = new Date();
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 90);
  const { data, error } = await supabase
    .from("commande_lignes")
    .select("quantite, prix_unitaire, total_ligne, commandes!inner(date_commande)")
    .eq("produit_id", produitId)
    .gte("commandes.date_commande", d90.toISOString().slice(0, 10));
  if (error) throw error;
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const d30s = d30.toISOString().slice(0, 10);
  let ca30 = 0,
    ca90 = 0,
    qte30 = 0,
    qte90 = 0;
  type Row = {
    quantite: number | null;
    prix_unitaire: number | null;
    total_ligne: number | null;
    commandes: { date_commande: string | null } | null;
  };
  for (const row of (data ?? []) as Row[]) {
    const date = row.commandes?.date_commande ?? null;
    const total = Number(row.total_ligne ?? 0);
    const qte = Number(row.quantite ?? 0);
    ca90 += total;
    qte90 += qte;
    if (date && date >= d30s) {
      ca30 += total;
      qte30 += qte;
    }
  }
  const coutAchat30 = qte30 * prixAchat;
  const marge30 = ca30 - coutAchat30;
  const margePct30 = ca30 > 0 ? (marge30 / ca30) * 100 : 0;
  const rotation90 = stockCourant > 0 ? qte90 / stockCourant : 0;
  return { ca30, ca90, qte30, qte90, marge30, margePct30, rotation90 };
}

export type StockPoint = { date: string; stock: number };

export type ProduitAchat = {
  achat_id: string;
  reference: string;
  libelle: string;
  montant: number; // total achat
  statut: string;
  date_achat: string;
  fournisseur: string | null;
  quantite: number; // qty for this product
  prix_unitaire: number; // price for this product
};

export type ProduitInventaire = {
  inventaire_id: string;
  reference: string;
  produit_nom: string;
  stock_theorique: number;
  stock_compte: number;
  ecart: number;
  date_inventaire: string;
  statut: string;
  notes: string | null;
};

export type ProduitHistorique = {
  id: string;
  date: string;
  type: "vente" | "achat" | "stock" | "inventaire";
  reference: string;
  libelle: string;
  quantite?: number;
  montant?: number;
  statut?: string | null;
};

export async function getStockHistory(
  produitId: string,
  stockCourant: number,
  days = 90,
): Promise<StockPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();
  const { data, error } = await supabase
    .from("stock_mouvements")
    .select("created_at, stock_resultant")
    .eq("produit_id", produitId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { created_at: string; stock_resultant: number | null }[];
  if (rows.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return [
      { date: since.toISOString().slice(0, 10), stock: stockCourant },
      { date: today, stock: stockCourant },
    ];
  }
  // last value per day
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    byDay.set(d, Number(r.stock_resultant ?? 0));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stock]) => ({ date, stock }));
}

export async function getProduitAchats(produitId: string, limit = 50) {
  const { data, error } = await supabase
    .from("achat_lignes")
    .select(
      "quantite, prix_unitaire, achat_id, achats!inner(reference, libelle, montant, statut, date_achat, fournisseurs(raison_sociale))",
    )
    .eq("produit_id", produitId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    achat_id: row.achat_id,
    reference: row.achats?.reference ?? "—",
    libelle: row.achats?.libelle ?? "—",
    montant: Number(row.achats?.montant ?? 0),
    statut: row.achats?.statut ?? "—",
    date_achat: row.achats?.date_achat ?? "",
    fournisseur: row.achats?.fournisseurs?.raison_sociale ?? null,
    quantite: Number(row.quantite ?? 0),
    prix_unitaire: Number(row.prix_unitaire ?? 0),
  })) as ProduitAchat[];
}

export async function getProduitInventaires(
  produit: { titre: string; reference: string },
  limit = 50,
) {
  void produit;
  // Query lignes by produit_id is not possible without id; we resolve via produits.
  const { data: prod } = await supabase
    .from("produits")
    .select("produit_id")
    .eq("reference", produit.reference)
    .maybeSingle();
  if (!prod) return [] as ProduitInventaire[];

  const { data, error } = await supabase
    .from("inventaire_lignes")
    .select(
      "ligne_id, designation, quantite_theorique, quantite_physique, ecart, observation, inventaires!inner(inventaire_id, reference, date_inventaire, statut)",
    )
    .eq("produit_id", prod.produit_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    inventaire_id: row.inventaires?.inventaire_id ?? "",
    reference: row.inventaires?.reference ?? "—",
    produit_nom: row.designation,
    stock_theorique: Number(row.quantite_theorique ?? 0),
    stock_compte: Number(row.quantite_physique ?? 0),
    ecart: Number(row.ecart ?? 0),
    date_inventaire: row.inventaires?.date_inventaire ?? "",
    statut: row.inventaires?.statut ?? "",
    notes: row.observation ?? null,
  })) as ProduitInventaire[];
}

export function buildProduitHistorique(input: {
  achats: ProduitAchat[];
  inventaires: ProduitInventaire[];
  mouvements: Array<{
    mouvement_id: string;
    created_at: string;
    type: string;
    quantite: number;
    stock_resultant: number;
  }>;
  ventes: VenteLigne[];
}): ProduitHistorique[] {
  return [
    ...input.ventes.map((v) => ({
      id: v.ligne_id,
      date: v.date_commande ?? "",
      type: "vente" as const,
      reference: v.commande_reference ?? "—",
      libelle: v.client_nom ? `Vente à ${v.client_nom}` : "Vente",
      quantite: Number(v.quantite ?? 0),
      montant: Number(v.total_ligne ?? 0),
      statut: v.statut,
    })),
    ...input.achats.map((a) => ({
      id: a.achat_id,
      date: a.date_achat,
      type: "achat" as const,
      reference: a.reference,
      libelle: a.fournisseur ? `${a.libelle} · ${a.fournisseur}` : a.libelle,
      montant: a.montant,
      statut: a.statut,
    })),
    ...input.mouvements.map((m) => ({
      id: m.mouvement_id,
      date: m.created_at,
      type: "stock" as const,
      reference: m.type,
      libelle: `Mouvement ${m.type} · stock ${m.stock_resultant}`,
      quantite: Number(m.quantite ?? 0),
    })),
    ...input.inventaires.map((i) => ({
      id: i.inventaire_id,
      date: i.date_inventaire,
      type: "inventaire" as const,
      reference: i.reference,
      libelle: `Inventaire · écart ${i.ecart}`,
      quantite: i.stock_compte,
      statut: i.statut,
    })),
  ]
    .filter((row) => row.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
