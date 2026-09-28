import { pgSafe } from "@/lib/postgrest-filter";
import { supabase } from "@/integrations/supabase/client";
import type { Produit } from "@/lib/produits-api";

export const TYPES_MOUVEMENT = [
  { value: "entree", label: "Entrée", color: "#10B981" },
  { value: "sortie", label: "Sortie", color: "#EF4444" },
  { value: "ajustement", label: "Ajustement", color: "#F97316" },
] as const;

export const TYPE_MOUVEMENT_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(TYPES_MOUVEMENT.map((t) => [t.value, { label: t.label, color: t.color }]));

export const ORIGINES_MOUVEMENT = [
  { value: "approvisionnement", label: "Approvisionnement", route: "/achats", paramKey: "achatId" },
  { value: "commande", label: "Commande validée", route: "/commandes", paramKey: "commandeId" },
  { value: "facture", label: "Facture", route: "/factures", paramKey: "factureId" },
  { value: "bl", label: "Bon de livraison", route: "/bons-livraison", paramKey: "blId" },
  { value: "retour", label: "Retour", route: "/retours", paramKey: "retourId" },
  { value: "specimen", label: "Spécimen", route: "/specimens", paramKey: "specimenId" },
  { value: "incident", label: "Incident de stock", route: "/incidents", paramKey: "incidentId" },
  { value: "inventaire", label: "Inventaire", route: "/inventaires", paramKey: "inventaireId" },
  {
    value: "transfert_sortant",
    label: "Transfert sortant",
    route: "/transferts",
    paramKey: "transfertId",
  },
  {
    value: "transfert_entrant",
    label: "Transfert entrant",
    route: "/transferts",
    paramKey: "transfertId",
  },
  { value: "ajustement", label: "Ajustement", route: null, paramKey: null },
] as const;

export const ORIGINE_LABEL: Record<string, { label: string; route: string | null }> =
  Object.fromEntries(ORIGINES_MOUVEMENT.map((o) => [o.value, { label: o.label, route: o.route }]));

export function buildOrigineHref(
  origine: string | null,
  document_id: string | null,
): string | null {
  if (!origine || !document_id) return null;
  const o = ORIGINES_MOUVEMENT.find((x) => x.value === origine);
  if (!o || !o.route) return null;
  return `${o.route}/${document_id}`;
}

export type StockMouvement = {
  mouvement_id: string;
  produit_id: string;
  depot_id: string | null;
  type: string;
  quantite: number;
  quantite_entree: number;
  quantite_sortie: number;
  stock_resultant: number;
  motif: string | null;
  origine: string | null;
  document_id: string | null;
  document_reference: string | null;
  document_table: string | null;
  user_id: string | null;
  user_nom: string | null;
  observation: string | null;
  created_at: string;
  depots?: { nom: string; code: string } | null;
};

export type MouvementInput = {
  produit_id: string;
  type: string;
  quantite: number;
  motif?: string | null;
};

export async function listStockProduits(q?: string) {
  // Lit v_produits pour que `stock` soit toujours la somme réelle des dépôts.
  let query = supabase.from("v_produits").select("*").eq("actif", true);
  if (q) query = query.or(`titre.ilike.%${pgSafe(q)}%,reference.ilike.%${pgSafe(q)}%,isbn.ilike.%${pgSafe(q)}%`);
  query = query
    .order("pin_order", { ascending: true })
    .order("niveau_ordre", { ascending: true })
    .order("titre", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Produit[];
}

export async function listMouvements(produitId: string) {
  const { data, error } = await supabase
    .from("stock_mouvements")
    .select("*, depots(nom, code)")
    .eq("produit_id", produitId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as StockMouvement[];
}

export type MouvementFiltres = {
  dateFrom?: string | null;
  dateTo?: string | null;
  depot_id?: string | null;
  type?: string | null;
  origine?: string | null;
  user_id?: string | null;
  q?: string | null;
};

export async function listMouvementsProduit(produit_id: string, f: MouvementFiltres = {}) {
  let q = supabase
    .from("stock_mouvements")
    .select("*, depots(nom, code)")
    .eq("produit_id", produit_id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (f.dateFrom) q = q.gte("created_at", f.dateFrom);
  if (f.dateTo) q = q.lte("created_at", f.dateTo);
  if (f.depot_id) q = q.eq("depot_id", f.depot_id);
  if (f.type) q = q.eq("type", f.type);
  if (f.origine) q = q.eq("origine", f.origine);
  if (f.user_id) q = q.eq("user_id", f.user_id);
  if (f.q) {
    const s = f.q.replace(/[%,]/g, "");
    q = q.or(
      `motif.ilike.%${s}%,observation.ilike.%${s}%,document_reference.ilike.%${s}%,user_nom.ilike.%${s}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as StockMouvement[];
}

export async function createMouvement(input: MouvementInput) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("stock.creer_mouvement");
  const { data, error } = await supabase
    .from("stock_mouvements")
    .insert({
      produit_id: input.produit_id,
      type: input.type,
      quantite: input.quantite,
      motif: input.motif ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as StockMouvement;
}
