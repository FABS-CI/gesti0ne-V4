import { supabase } from "@/integrations/supabase/client";
import { typeClientVariants } from "@/lib/company";

export type Client = {
  client_id: string;
  reference: string;
  nom: string;
  type_client: string;
  representant: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  quartier: string | null;
  commune: string | null;
  bp: string | null;
  pays: string | null;
  nif: string | null;
  regime_fiscal: string | null;
  categorie: string | null;
  secteur_activite: string | null;
  mode_paiement: string | null;
  delai_paiement: number | null;
  remise_habituelle: number | null;
  plafond_credit: number;
  solde: number;
  notes: string | null;
  statut: string | null;
  motif_blocage: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientInput = {
  nom: string;
  type_client: string;
  representant?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  quartier?: string | null;
  commune?: string | null;
  ville?: string | null;
  bp?: string | null;
  pays?: string | null;
  nif?: string | null;
  regime_fiscal?: string | null;
  categorie?: string | null;
  secteur_activite?: string | null;
  mode_paiement?: string | null;
  delai_paiement?: number | null;
  remise_habituelle?: number | null;
  plafond_credit?: number;
  notes?: string | null;
};


export type ListClientsParams = {
  q?: string;
  type_client?: string;
  ville?: string;
  actif?: boolean;
  clientIds?: string[];
  page?: number;
  pageSize?: number;
};

export async function listClients(params: ListClientsParams = {}) {
  const { q, type_client, ville, actif, clientIds, page = 1, pageSize = 20 } = params;

  if (clientIds && clientIds.length === 0) {
    return { items: [] as Client[], total: 0, page, pageSize };
  }

  let query = supabase.from("clients").select("*", { count: "exact" });
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `nom.ilike.${like},reference.ilike.${like},representant.ilike.${like},phone_normalized.ilike.${like}`
    );
  }
  if (type_client) query = query.in("type_client", typeClientVariants(type_client));
  if (ville) query = query.ilike("ville", `%${ville}%`);
  if (actif != null) query = query.eq("actif", actif);
  if (clientIds) query = query.in("client_id", clientIds);

  const from = (page - 1) * pageSize;
  query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as Client[], total: count ?? 0, page, pageSize };
}

export async function createClient(payload: ClientInput) {
  const { data, error } = await supabase.from("clients").insert(payload).select().single();
  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, payload: Partial<ClientInput>) {
  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("client_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function disableClient(id: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("clients.supprimer");
  const { error } = await supabase.from("clients").update({ actif: false }).eq("client_id", id);
  if (error) throw error;
}

/**
 * Suppression définitive d'un client via la RPC `supprimer_client`.
 * La procédure applique la garde métier : si le client est référencé (factures,
 * commandes, paiements, mouvements de fidélité, etc.), la RPC lève une erreur
 * `foreign_key_violation` et laisse à l'utilisateur le soin de désactiver la fiche.
 */
export async function deleteClient(id: string, motif?: string | null) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("clients.supprimer");
  const { data, error } = await supabase.rpc("supprimer_client", {
    _client_id: id,
    _motif: motif ?? undefined,
  });
  if (error) throw error;
  return data;
}

/** Bloque ou débloque un client (avec motif optionnel). */
export async function setClientBlocage(id: string, bloque: boolean, motif?: string | null) {
  const { error } = await supabase
    .from("clients")
    .update({
      actif: !bloque,
      statut: bloque ? "bloque" : "actif",
      motif_blocage: bloque ? (motif ?? null) : null,
    })
    .eq("client_id", id);
  if (error) throw error;
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("client_id", id).single();
  if (error) throw error;
  return data as Client;
}

export type ClientRelations = {
  commandes: Array<{
    commande_id: string;
    reference: string;
    statut: string;
    date_commande: string;
    montant_total: number;
  }>;
  factures: Array<{
    facture_id: string;
    reference: string;
    statut: string;
    date_facture: string;
    montant_total: number;
    montant_paye: number;
  }>;
  paiements: Array<{
    paiement_id: string;
    reference: string;
    mode_paiement: string;
    statut: string;
    date_paiement: string;
    montant: number;
  }>;
  livraisons: Array<{
    livraison_id: string;
    reference: string;
    statut: string;
    date_livraison: string | null;
    transporteur: string | null;
  }>;
  proformas: Array<{
    proforma_id: string;
    reference: string;
    statut: string;
    date_proforma: string;
    date_validite: string | null;
    montant_total: number;
  }>;
  bons_livraison: Array<{
    bl_id: string;
    reference: string;
    statut: string;
    date_emission: string;
    date_livraison: string | null;
    montant_total: number;
    commande_id: string | null;
  }>;
  avoirs: Array<{
    retour_id: string;
    reference: string;
    statut: string;
    date_retour: string;
    montant: number;
    motif: string | null;
  }>;

};

export async function getClientRelations(
  clientId: string,
  clientNom: string,
): Promise<ClientRelations> {
  const [cmd, fac, pro, bl, av] = await Promise.all([
    supabase
      .from("commandes")
      .select("commande_id,reference,statut,date_commande,montant_total")
      .eq("client_id", clientId)
      .order("date_commande", { ascending: false }),
    supabase
      .from("factures")
      .select("facture_id,reference,statut,date_facture,montant_total,montant_paye")
      .eq("client_id", clientId)
      .order("date_facture", { ascending: false }),
    supabase
      .from("proformas")
      .select("proforma_id,reference,statut,date_proforma,date_validite,montant_total")
      .eq("client_id", clientId)
      .order("date_proforma", { ascending: false }),
    supabase
      .from("bons_livraison")
      .select("bl_id,reference,statut,date_emission,date_livraison,montant,commande_id")
      .eq("client_id", clientId)
      .order("date_emission", { ascending: false }),
    supabase
      .from("retours")
      .select("retour_id,reference,statut,date_retour,montant,motif")
      .eq("client_id", clientId)
      .order("date_retour", { ascending: false }),
  ]);

  if (cmd.error) throw cmd.error;
  if (fac.error) throw fac.error;
  if (pro.error) throw pro.error;
  if (bl.error) throw bl.error;
  if (av.error) throw av.error;

  const blIds = (bl.data ?? []).map((b) => b.bl_id);
  let livraisons: ClientRelations["livraisons"] = [];
  if (blIds.length > 0) {
    const { data, error } = await supabase
      .from("livraisons")
      .select("livraison_id,reference,statut,date_livraison,transporteur:transporteur_id,bl_id")
      .in("bl_id", blIds)
      .order("date_livraison", { ascending: false });
    if (error) throw error;
    livraisons = (data ?? []).map((l) => ({
      livraison_id: l.livraison_id,
      reference: l.reference,
      statut: l.statut,
      date_livraison: l.date_livraison,
      transporteur: null,
    })) as ClientRelations["livraisons"];
  }


  const factureIds = (fac.data ?? []).map((f) => f.facture_id);
  let paiements: ClientRelations["paiements"] = [];
  if (factureIds.length > 0) {
    const { data, error } = await supabase
      .from("paiements")
      .select("paiement_id,reference,mode_paiement,statut,date_paiement,montant,facture_id")
      .in("facture_id", factureIds)
      .order("date_paiement", { ascending: false });
    if (error) throw error;
    paiements = (data ?? []).map(({ facture_id: _f, ...p }) => p) as ClientRelations["paiements"];
  }

  return {
    commandes: (cmd.data ?? []) as ClientRelations["commandes"],
    factures: (fac.data ?? []) as ClientRelations["factures"],
    paiements,
    livraisons,
    proformas: (pro.data ?? []) as ClientRelations["proformas"],
    bons_livraison: ((bl.data ?? []) as Array<Record<string, unknown>>).map(
      ({ montant, ...b }) => ({ ...b, montant_total: Number(montant ?? 0) }),
    ) as ClientRelations["bons_livraison"],
    avoirs: (av.data ?? []) as ClientRelations["avoirs"],
  };
}


/** Détecte les clients existants au nom similaire (pour avertir des doublons). */
export async function findDuplicateClients(nom: string, excludeId?: string) {
  const term = nom.trim();
  if (term.length < 3) return [] as Client[];
  let query = supabase.from("clients").select("*").ilike("nom", `%${term}%`).limit(5);
  if (excludeId) query = query.neq("client_id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Client[];
}

export type ClientAuditRow = {
  id: string;
  user_email: string | null;
  action: string;
  record_id: string | null;
  created_at: string;
};

/** Historique d'audit (création/modif/suppression) pour un client donné. */
export async function getClientAudit(
  clientId: string,
  opts: { action?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: ClientAuditRow[]; total: number; page: number; pageSize: number }> {
  const { action, page = 1, pageSize = 10 } = opts;
  let query = supabase
    .from("audit_logs")
    .select("id, user_email, action, record_id, created_at", { count: "exact" })
    .eq("table_name", "clients")
    .ilike("record_id", `%${clientId}%`);

  if (action) query = query.eq("action", action);

  const from = (page - 1) * pageSize;
  query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as ClientAuditRow[], total: count ?? 0, page, pageSize };
}
