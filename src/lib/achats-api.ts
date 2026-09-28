import { pgSafe } from "@/lib/postgrest-filter";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

export const STATUTS_ACHAT = [
  { value: "brouillon", label: "Brouillon", color: "#94A3B8" },
  { value: "commande", label: "Commandé", color: "#3B82F6" },
  { value: "recu", label: "Reçu", color: "#F97316" },
  { value: "paye", label: "Payé", color: "#10B981" },
  { value: "annule", label: "Annulé", color: "#EF4444" },
] as const;

export const STATUT_ACHAT_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_ACHAT.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Achat = {
  achat_id: string;
  reference: string;
  fournisseur_id: string | null;
  libelle: string;
  montant: number;
  statut: string;
  date_achat: string;
  notes: string | null;
  reference_fournisseur: string | null;
  created_by: string | null;
  created_by_nom: string | null;
  created_at: string;
  updated_at: string;
  fournisseurs?: {
    raison_sociale: string;
    reference?: string | null;
    representant?: string | null;
    email?: string | null;
    telephone?: string | null;
    adresse?: string | null;
    ville?: string | null;
  } | null;
};

export type AchatLigne = {
  ligne_id: string;
  achat_id: string;
  produit_id: string | null;
  reference_produit: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  /** Remise appliquée à la ligne, en pourcentage (0-100). */
  remise_pct: number;
  total_ligne: number;
  created_at: string;
  produits?: {
    cover_path: string | null;
    cover_thumb_path: string | null;
  } | null;
};

export type ApprovisionnementLigneInput = {
  produit_id: string | null;
  reference_produit?: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  /** Remise en pourcentage (0-100). */
  remise_pct?: number;
};

export type ApprovisionnementInput = {
  fournisseur_id: string;
  depot_id: string;
  date_achat: string;
  reference_fournisseur?: string | null;
  notes?: string | null;
  /** Clé d'idempotence générée à l'ouverture du formulaire (anti-doublon). */
  idempotency_key?: string | null;
  lignes: ApprovisionnementLigneInput[];
};

export type AchatInput = {
  fournisseur_id?: string | null;
  libelle: string;
  montant: number;
  statut: string;
  date_achat: string;
  notes?: string | null;
};

/** Filtres portant sur les articles contenus dans les lignes d'approvisionnement. */
export type AchatArticleFilters = {
  /** Recherche partielle sur la désignation de l'article. */
  article?: string;
  /** Recherche partielle sur la référence (code) de l'article. */
  refArticle?: string;
  /** Catégorie exacte du produit lié. */
  categorie?: string;
};

/** Renvoie les ids d'approvisionnements contenant au moins une ligne correspondant aux filtres. */
async function findAchatIdsByArticle(f: AchatArticleFilters): Promise<string[]> {
  let produitIds: string[] | null = null;
  if (f.categorie) {
    const { data: prods, error: prodErr } = await supabase
      .from("produits")
      .select("produit_id")
      .eq("categorie", f.categorie)
      .limit(5000);
    if (prodErr) throw prodErr;
    produitIds = (prods ?? []).map((p) => p.produit_id);
    if (produitIds!.length === 0) return [];
  }

  let query = supabase.from("achat_lignes").select("achat_id");
  if (f.article) query = query.ilike("designation", `%${f.article}%`);
  if (f.refArticle) query = query.ilike("reference_produit", `%${f.refArticle}%`);
  if (produitIds) query = query.in("produit_id", produitIds);
  const { data, error } = await query.limit(5000);
  if (error) throw error;
  return Array.from(new Set(((data ?? []) as { achat_id: string }[]).map((r) => r.achat_id)));
}

export async function listAchats(
  q?: string,
  statut?: string,
  exerciceId?: string | null,
  filters?: AchatArticleFilters,
) {
  const hasArticleFilter = !!(filters?.article || filters?.refArticle || filters?.categorie);
  let achatIds: string[] | null = null;
  if (hasArticleFilter) {
    achatIds = await findAchatIdsByArticle(filters!);
    if (achatIds.length === 0) return [] as Achat[];
  }

  let query = supabase.from("achats").select("*, fournisseurs(raison_sociale, reference, representant, email, telephone, adresse, ville)");
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (q) query = query.or(`libelle.ilike.%${pgSafe(q)}%,reference.ilike.%${pgSafe(q)}%`);
  if (statut) query = query.eq("statut", statut);
  if (achatIds) query = query.in("achat_id", achatIds);
  query = query.order("date_achat", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Achat[];
}

export async function createAchat(input: AchatInput) {
  const { data, error } = await supabase.from("achats").insert(input).select().single();
  if (error) throw error;
  return data as Achat;
}

export async function updateAchat(id: string, input: AchatInput) {
  const { data, error } = await supabase
    .from("achats")
    .update(input)
    .eq("achat_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Achat;
}

export async function deleteAchat(id: string, motif?: string | null) {
  const { error } = await supabase.rpc("supprimer_achat" as never, {
    _achat_id: id,
    _motif: motif ?? "",
  } as never);
  if (error) throw error;
}

export async function confirmerAchat(id: string) {
  const { error } = await callRpc("confirmer_achat", { _achat_id: id });
  if (error) throw error;
}

export async function receptionnerAchat(id: string) {
  const { error } = await supabase.rpc("receptionner_achat", { _achat_id: id });
  if (error) throw error;
}

export async function payerAchat(id: string) {
  const { error } = await supabase.rpc("payer_achat", { _achat_id: id });
  if (error) throw error;
}

export async function getAchat(id: string) {
  const { data, error } = await supabase
    .from("achats")
    .select("*, fournisseurs(raison_sociale, reference, representant, email, telephone, adresse, ville)")
    .eq("achat_id", id)
    .single();
  if (error) throw error;
  return data as Achat;
}

export async function getAchatLignes(achatId: string) {
  // We use standard join here; PostgREST will use the FK achat_lignes_produit_id_fkey
  const { data, error } = await supabase
    .from("achat_lignes")
    .select("*, produits(reference, categorie, niveau, matiere, cover_path, cover_thumb_path)")
    .eq("achat_id", achatId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error fetching achat_lignes with produits:", error);
    throw error;
  }
  return (data ?? []) as unknown as AchatLigne[];
}

export async function listAchatLignesByAchats(achatIds: string[]) {
  if (achatIds.length === 0) return {} as Record<string, AchatLigne[]>;
  const { data, error } = await supabase
    .from("achat_lignes")
    .select("*, produits(reference, categorie, niveau, matiere, cover_path, cover_thumb_path)")
    .in("achat_id", achatIds);
  if (error) {
    console.error("Error listing achat_lignes by achats:", error);
    throw error;
  }
  const map: Record<string, AchatLigne[]> = {};
  (data ?? []).forEach((l) => {
    const k = l.achat_id;
    if (!map[k]) map[k] = [];
    map[k].push(l as unknown as AchatLigne);
  });
  return map;
}

export async function creerApprovisionnement(input: ApprovisionnementInput) {
  const payload = {
    fournisseur_id: input.fournisseur_id,
    depot_id: input.depot_id,
    date_achat: input.date_achat,
    reference_fournisseur: input.reference_fournisseur ?? null,
    notes: input.notes ?? null,
    idempotency_key: input.idempotency_key ?? null,
    lignes: input.lignes.map((l) => ({
      produit_id: l.produit_id,
      reference_produit: l.reference_produit ?? null,
      designation: l.designation,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      remise_pct: l.remise_pct ?? 0,
    })),
  };
  const { data, error } = await callRpc("enregistrer_approvisionnement", {
    _payload: payload,
  });
  if (error) throw error;
  return data as Achat;
}

export async function modifierApprovisionnement(id: string, input: ApprovisionnementInput) {
  const payload = {
    fournisseur_id: input.fournisseur_id,
    depot_id: input.depot_id,
    date_achat: input.date_achat,
    reference_fournisseur: input.reference_fournisseur ?? null,
    notes: input.notes ?? null,
    lignes: input.lignes.map((l) => ({
      produit_id: l.produit_id,
      reference_produit: l.reference_produit ?? null,
      designation: l.designation,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      remise_pct: l.remise_pct ?? 0,
    })),
  };
  const { data, error } = await supabase.rpc("modifier_approvisionnement" as never, {
    _achat_id: id,
    _payload: payload,
  } as never);
  if (error) throw error;
  return data as Achat;
}
