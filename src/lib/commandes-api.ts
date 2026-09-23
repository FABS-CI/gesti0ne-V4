import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import { getDepotDefautId } from "@/lib/parametres-api";

export const STATUTS_COMMANDE = [
  { value: "brouillon", label: "Brouillon", color: "#64748B" },
  { value: "en_attente_validation", label: "En attente de validation", color: "#F59E0B" },
  { value: "validee", label: "Validée", color: "#3B82F6" },
  { value: "facturee", label: "Facturée", color: "#8B5CF6" },
  { value: "livree", label: "Livrée", color: "#10B981" },
  { value: "annulee", label: "Annulée", color: "#EF4444" },
] as const;

export const STATUT_LABEL: Record<string, { label: string; color: string }> = Object.fromEntries(
  STATUTS_COMMANDE.map((s) => [s.value, { label: s.label, color: s.color }]),
);

export type CommandeLigne = {
  ligne_id?: string;
  produit_id?: string | null;
  reference_produit?: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct?: number;
  montant_remise?: number;
  total_ligne: number;
  total_ht_ligne?: number;
  cover_path?: string | null;
  cover_thumb_path?: string | null;
  produits?: any | null;
};

export type Commande = {
  commande_id: string;
  reference: string;
  numero: string | null;
  client_id: string | null;
  client_nom: string | null;
  etablissement: string | null;
  representant_nom: string | null;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  observations: string | null;
  statut: string;
  date_commande: string;
  remise: number;
  nb_produits: number;
  total_quantite: number;
  total_ht_brut: number;
  total_remises_lignes: number;
  total_ht_net: number;
  remise_globale_pct: number;
  remise_globale_montant: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  net_a_payer: number;
  montant_total: number;
  commercial_id: string | null;
  commercial_nom: string | null;
  created_by: string | null;
  created_by_nom: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// === RPC-based API (Phase 1+) ===

export type CreerCommandeLignePayload = {
  produit_id: string;
  reference_produit?: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct?: number;
};

export type CreerCommandePayload = {
  date_commande: string;
  client_id: string;
  client_nom?: string | null;
  etablissement?: string | null;
  representant_nom?: string | null;
  telephone?: string | null;
  ville?: string | null;
  adresse?: string | null;
  observations?: string | null;
  remise_globale_pct?: number;
  taux_tva?: number;
  depot_id?: string | null;
  idempotency_key?: string | null;
  auto_validate: boolean;
  type_frais_transport?: "livraison" | "expedition" | null;
  montant_frais_transport?: number | null;
  lignes: CreerCommandeLignePayload[];
};

export async function creerCommande(payload: CreerCommandePayload) {
  if (typeof payload.auto_validate !== "boolean") {
    throw new Error("Le choix de validation de la commande est obligatoire");
  }
  const depot_id = payload.depot_id ?? (await getDepotDefautId());
  console.info("[commande.workflow] Envoi au backend", {
    autoValidate: payload.auto_validate,
    idempotencyKey: payload.idempotency_key ?? null,
    lineCount: payload.lignes.length,
  });
  const { data, error } = await callRpc("creer_commande", {
    _payload: { ...payload, depot_id } as never,
  });
  if (error) throw new Error(error.message);
  const created = Array.isArray(data) ? data[0] : data;
  console.info("[commande.workflow] Réponse du backend", {
    commandeId: created?.commande_id ?? null,
    reference: created?.reference ?? null,
    statut: created?.statut ?? null,
    autoValidateRequested: payload.auto_validate,
  });
  return created as unknown as Commande;
}

export async function modifierCommande(commandeId: string, payload: Partial<CreerCommandePayload>) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.modifier");
  const { data, error } = await supabase.rpc("modifier_commande", {
    _commande_id: commandeId,
    _payload: payload as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Commande;
}

export async function soumettreCommande(commandeId: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.soumettre");
  const { error } = await supabase.rpc("soumettre_commande", { _commande_id: commandeId });
  if (error) throw new Error(error.message);
}

export async function genererProformaCommande(commandeId: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.generer_proforma");
  const { data, error } = await supabase.rpc("generer_proforma_commande", {
    _commande_id: commandeId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export type ListCommandesParams = {
  q?: string;
  statut?: string;
  page?: number;
  pageSize?: number;
  reference?: string;
  client?: string;
  telephone?: string;
  commercial?: string;
  ville?: string;
  dateDu?: string;
  dateAu?: string;
  montantMin?: number;
  montantMax?: number;
  exerciceId?: string | null;
};

export async function listCommandes(params: ListCommandesParams = {}) {
  const {
    q,
    statut,
    page = 1,
    pageSize = 20,
    reference,
    client,
    telephone,
    commercial,
    ville,
    dateDu,
    dateAu,
    montantMin,
    montantMax,
    exerciceId,
  } = params;
  // P0 perf : projection restreinte aux colonnes utilisées par la liste
  // (badges, KPI, actions). Évite de transférer 40+ colonnes/ligne.
  const LIST_COLS =
    "commande_id, reference, numero, client_id, client_nom, telephone, ville, statut, date_commande, montant_total, net_a_payer, created_at, commercial_nom, created_by";
  let query = supabase.from("commandes").select(LIST_COLS, { count: "estimated" });

  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (q) query = query.or(`reference.ilike.%${q}%,client_nom.ilike.%${q}%`);
  if (statut) query = query.eq("statut", statut);
  if (reference) query = query.ilike("reference", `%${reference}%`);
  if (client) query = query.ilike("client_nom", `%${client}%`);
  if (telephone) query = query.ilike("telephone", `%${telephone}%`);
  if (commercial) query = query.ilike("commercial_nom", `%${commercial}%`);
  if (ville) query = query.ilike("ville", `%${ville}%`);
  if (dateDu) query = query.gte("date_commande", dateDu);
  if (dateAu) query = query.lte("date_commande", dateAu);
  if (montantMin !== undefined) query = query.gte("montant_total", montantMin);
  if (montantMax !== undefined) query = query.lte("montant_total", montantMax);

  const from = (page - 1) * pageSize;
  query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as Commande[], total: count ?? 0, page, pageSize };
}

export async function getCommandeLignes(commandeId: string) {
  const { data, error } = await supabase
    .from("commande_lignes")
    .select("*")
    .eq("commande_id", commandeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const lignes = (data ?? []) as CommandeLigne[];

  // Enrichissement des couvertures (pas de FK exploitable pour une jointure PostgREST)
  const ids = Array.from(
    new Set(lignes.map((l) => l.produit_id).filter(Boolean)),
  ) as string[];
  if (ids.length === 0) return lignes;

  const { data: prods } = await supabase
    .from("produits")
    .select("produit_id, cover_path, cover_thumb_path")
    .in("produit_id", ids);
  const map = new Map<string, any>((prods ?? []).map((p: any) => [p.produit_id, p]));
  return lignes.map((l) => {
    const p = l.produit_id ? map.get(l.produit_id) : null;
    return {
      ...l,
      cover_path: p?.cover_path ?? null,
      cover_thumb_path: p?.cover_thumb_path ?? null,
      produits: p ?? null,
    };
  });
}

export async function deleteCommande(id: string, motif?: string | null, force?: boolean) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.supprimer");
  const { data, error } = await supabase.rpc("supprimer_commande_definitif", {
    _commande_id: id,
    _motif: motif ?? undefined,
    _force: force ?? false,
  } as never);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? {}) as Record<string, number>;
}

export async function demanderAnnulationCommande(commandeId: string, motif: string) {
  const { data, error } = await supabase.rpc("commande_demander_annulation", {
    p_commande_id: commandeId,
    p_motif: motif,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getCommande(id: string) {
  const { data, error } = await supabase
    .from("commandes")
    .select("*")
    .eq("commande_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Commande | null;
}
