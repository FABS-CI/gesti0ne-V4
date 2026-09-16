import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import { assertPermission } from "@/lib/rbac-api";

export const TYPES_INVENTAIRE = [
  { value: "physique", label: "Physique" },
  { value: "theorique", label: "Théorique" },
  { value: "global", label: "Global" },
  { value: "par_depot", label: "Par dépôt" },
] as const;

export const STATUTS_INVENTAIRE = [
  { value: "brouillon", label: "Brouillon", color: "#94A3B8" },
  { value: "valide", label: "Validé", color: "#3B82F6" },
  { value: "regularise", label: "Régularisé", color: "#10B981" },
  { value: "annule", label: "Annulé", color: "#EF4444" },
] as const;

export const STATUT_INVENTAIRE_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_INVENTAIRE.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Inventaire = {
  inventaire_id: string;
  numero: string;
  type_inventaire: string;
  depot_id: string | null;
  categorie_id: string | null;
  date_inventaire: string;
  statut: string;
  nb_produits: number;
  nb_ecarts: number;
  valeur_totale: number;
  observations: string | null;
  created_by: string | null;
  created_by_nom: string | null;
  validated_at: string | null;
  regularized_at: string | null;
  created_at: string;
  updated_at: string;
  depots?: { nom: string; code: string } | null;
};

export type InventaireLigne = {
  ligne_id: string;
  inventaire_id: string;
  produit_id: string;
  reference_produit: string | null;
  designation: string;
  stock_theorique: number;
  quantite_comptee: number;
  ecart: number;
  valeur_unitaire: number;
  valeur_ecart: number;
  observation: string | null;
  produits?: {
    prix_achat: number | null;
    prix_vente: number | null;
    niveau: string | null;
    niveau_ordre: number | null;
    pin_order: number | null;
  } | null;
};

export async function listInventaires(filters?: {
  statut?: string;
  type?: string;
  exerciceId?: string | null;
}) {
  let q = supabase
    .from("inventaires")
    .select("*, depots(nom, code)")
    .order("date_inventaire", { ascending: false });
  if (filters?.exerciceId) q = q.eq("exercice_id", filters.exerciceId);
  if (filters?.statut) q = q.eq("statut", filters.statut);
  if (filters?.type) q = q.eq("type_inventaire", filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Inventaire[];
}

export async function getInventaire(id: string) {
  const { data, error } = await supabase
    .from("inventaires")
    .select("*, depots(nom, code)")
    .eq("inventaire_id", id)
    .single();
  if (error) throw error;
  return data as Inventaire;
}

export async function getInventaireLignes(id: string) {
  const { data, error } = await supabase
    .from("inventaire_lignes")
    .select("*, produits(prix_achat, prix_vente, niveau, niveau_ordre, pin_order)")
    .eq("inventaire_id", id)
    .order("designation");
  if (error) throw error;
  const lignes = (data ?? []) as InventaireLigne[];
  // Tri pédagogique : pin_order (produit épinglé) → niveau_ordre → désignation.
  lignes.sort((a, b) => {
    const pa = a.produits?.pin_order ?? 1;
    const pb = b.produits?.pin_order ?? 1;
    if (pa !== pb) return pa - pb;
    const oa = a.produits?.niveau_ordre ?? 9999;
    const ob = b.produits?.niveau_ordre ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.designation.localeCompare(b.designation, "fr");
  });
  return lignes;
}

/** Les RPC d'inventaire renvoient SETOF inventaires : on normalise en un objet. */
function firstInventaire(data: unknown): Inventaire {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Inventaire introuvable après l'opération");
  return row as Inventaire;
}

export async function creerInventairePhysique(input: {
  depot_id: string;
  categorie_id?: string | null;
  date_inventaire: string;
  observations?: string | null;
}) {
  await assertPermission("inventaires.creer");
  const { data, error } = await supabase.rpc("creer_inventaire_physique", {
    _payload: {
      type_inventaire: "physique",
      depot_id: input.depot_id,
      categorie_id: input.categorie_id ?? null,
      date_inventaire: input.date_inventaire,
      observations: input.observations ?? null,
    },
  });
  if (error) throw error;
  return firstInventaire(data);
}

export async function creerInventaireTheorique(input: {
  depot_id: string;
  date_inventaire: string;
  observations?: string | null;
}) {
  await assertPermission("inventaires.creer");
  const { data, error } = await supabase.rpc("creer_inventaire_theorique", {
    _payload: {
      depot_id: input.depot_id,
      date_inventaire: input.date_inventaire,
      observations: input.observations ?? null,
    },
  });
  if (error) throw error;
  return firstInventaire(data);
}

export async function creerInventaireGlobal(input?: {
  date_inventaire?: string;
  observations?: string | null;
}) {
  await assertPermission("inventaires.creer");
  const { data, error } = await supabase.rpc("creer_inventaire_global", {
    _payload: {
      date_inventaire: input?.date_inventaire ?? new Date().toISOString().slice(0, 10),
      observations: input?.observations ?? null,
    },
  });
  if (error) throw error;
  return firstInventaire(data);
}

export async function validerInventairePhysique(
  inventaire_id: string,
  lignes: { ligne_id: string; quantite_comptee: number; observation?: string | null }[],
) {
  await assertPermission("inventaires.valider");
  const { data, error } = await supabase.rpc("valider_inventaire_physique", {
    _inventaire_id: inventaire_id,
    _lignes: lignes,
  });
  if (error) throw error;
  return firstInventaire(data);
}

export async function regulariserInventaire(inventaire_id: string) {
  await assertPermission("inventaires.regulariser");
  const { error } = await supabase.rpc("regulariser_inventaire", { _inventaire_id: inventaire_id });
  if (error) throw error;
}

export async function annulerInventaire(inventaire_id: string) {
  await assertPermission("inventaires.annuler");
  const { error } = await callRpc("annuler_inventaire", { _inventaire_id: inventaire_id });
  if (error) throw error;
}

export async function supprimerInventaire(inventaire_id: string) {
  const { error } = await supabase
    .from("inventaires")
    .delete()
    .eq("inventaire_id", inventaire_id);
  if (error) throw error;
}

export async function verrouillerInventaire(inventaire_id: string) {
  const { error } = await supabase
    .from("inventaires")
    .update({ statut: "valide", validated_at: new Date().toISOString() })
    .eq("inventaire_id", inventaire_id);
  if (error) throw error;
}

export async function deverrouillerInventaire(inventaire_id: string) {
  const { error } = await supabase
    .from("inventaires")
    .update({ statut: "brouillon", validated_at: null })
    .eq("inventaire_id", inventaire_id);
  if (error) throw error;
}
