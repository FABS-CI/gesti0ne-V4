// @ts-nocheck — schema temporarily reduced after reset.
import { pgSafe } from "@/lib/postgrest-filter";
import { supabase } from "@/integrations/supabase/client";

export const STATUTS_FACTURE = [
  { value: "impayee", label: "Impayée", color: "#EF4444" },
  { value: "partielle", label: "Partielle", color: "#F97316" },
  { value: "payee", label: "Payée", color: "#10B981" },
  { value: "annulee", label: "Annulée", color: "#64748B" },
  { value: "avoir", label: "Avoir", color: "#8B5CF6" },
] as const;

export const STATUT_FACTURE_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_FACTURE.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Facture = {
  facture_id: string;
  reference: string;
  client_id: string | null;
  client_nom: string | null;
  commande_id: string | null;
  date_facture: string;
  date_echeance: string | null;
  montant_total: number;
  montant_paye: number;
  statut: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};


export type ListFacturesAdvanced = {
  reference?: string;
  client?: string;
  telephone?: string;
  commercial?: string;
  ville?: string;
  commande?: string;
  dateDu?: string;
  dateAu?: string;
  montantMin?: number;
  montantMax?: number;
};

export async function listFactures(
  q?: string,
  statut?: string,
  adv: ListFacturesAdvanced = {},
  exerciceId?: string | null,
) {
  // Pré-requêtes de jointure (clients par téléphone/commercial/ville,
  // commandes par référence) → collecte des IDs à filtrer.
  let clientIds: string[] | null = null;
  if (adv.telephone || adv.commercial || adv.ville) {
    let cq = supabase.from("clients").select("client_id");
    if (adv.telephone) cq = cq.ilike("telephone", `%${adv.telephone}%`);
    if (adv.commercial) cq = cq.ilike("representant", `%${adv.commercial}%`);
    if (adv.ville) cq = cq.ilike("ville", `%${adv.ville}%`);
    const { data, error } = await cq.limit(2000);
    if (error) throw error;
    clientIds = (data ?? []).map((r) => r.client_id as string).filter(Boolean);
    if (clientIds.length === 0) return [];
  }
  let commandeIds: string[] | null = null;
  if (adv.commande) {
    const { data, error } = await supabase
      .from("commandes")
      .select("commande_id")
      .ilike("reference", `%${adv.commande}%`)
      .limit(2000);
    if (error) throw error;
    commandeIds = (data ?? []).map((r) => r.commande_id as string).filter(Boolean);
    if (commandeIds.length === 0) return [];
  }

  let query = supabase.from("factures").select("*");
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (q) query = query.or(`reference.ilike.%${pgSafe(q)}%,client_nom.ilike.%${pgSafe(q)}%`);
  if (statut) query = query.eq("statut", statut);
  if (adv.reference) query = query.ilike("reference", `%${adv.reference}%`);
  if (adv.client) query = query.ilike("client_nom", `%${adv.client}%`);
  if (clientIds) query = query.in("client_id", clientIds);
  if (commandeIds) query = query.in("commande_id", commandeIds);
  if (adv.dateDu) query = query.gte("date_facture", adv.dateDu);
  if (adv.dateAu) query = query.lte("date_facture", adv.dateAu);
  if (adv.montantMin !== undefined) query = query.gte("montant_total", adv.montantMin);
  if (adv.montantMax !== undefined) query = query.lte("montant_total", adv.montantMax);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Facture[];
}

export type ListFacturesPaginatedResult = {
  items: Facture[];
  totalCount: number;
  sumMontantTotal: number;
  sumMontantPaye: number;
};

/**
 * Version paginée server-side via RPC `factures_list_paginated`.
 * Renvoie la page demandée + les totaux (count, montants) calculés côté base.
 * Utilisée par les écrans à gros volumes pour éviter de tout charger côté navigateur.
 */
export async function listFacturesPaginated(params: {
  q?: string;
  statut?: string;
  exerciceId?: string | null;
  adv?: ListFacturesAdvanced;
  page: number;
  pageSize: number;
}): Promise<ListFacturesPaginatedResult> {
  const { q, statut, exerciceId, adv = {}, page, pageSize } = params;

  // Résolution client/commande → IDs
  let clientIds: string[] | null = null;
  if (adv.telephone || adv.commercial || adv.ville) {
    let cq = supabase.from("clients").select("client_id");
    if (adv.telephone) cq = cq.ilike("telephone", `%${adv.telephone}%`);
    if (adv.commercial) cq = cq.ilike("representant", `%${adv.commercial}%`);
    if (adv.ville) cq = cq.ilike("ville", `%${adv.ville}%`);
    const { data, error } = await cq.limit(2000);
    if (error) throw error;
    clientIds = (data ?? []).map((r) => r.client_id as string).filter(Boolean);
    if (clientIds.length === 0)
      return { items: [], totalCount: 0, sumMontantTotal: 0, sumMontantPaye: 0 };
  }
  let commandeIds: string[] | null = null;
  if (adv.commande) {
    const { data, error } = await supabase
      .from("commandes")
      .select("commande_id")
      .ilike("reference", `%${adv.commande}%`)
      .limit(2000);
    if (error) throw error;
    commandeIds = (data ?? []).map((r) => r.commande_id as string).filter(Boolean);
    if (commandeIds.length === 0)
      return { items: [], totalCount: 0, sumMontantTotal: 0, sumMontantPaye: 0 };
  }

  const applyFilters = (qb: any): any => {
    let query: any = qb;
    if (exerciceId) query = query.eq("exercice_id", exerciceId);
    if (q) query = query.or(`reference.ilike.%${pgSafe(q)}%,client_nom.ilike.%${pgSafe(q)}%`);
    if (statut) query = query.eq("statut", statut);
    if (adv.reference) query = query.ilike("reference", `%${adv.reference}%`);
    if (adv.client) query = query.ilike("client_nom", `%${adv.client}%`);
    if (clientIds) query = query.in("client_id", clientIds);
    if (commandeIds) query = query.in("commande_id", commandeIds);
    if (adv.dateDu) query = query.gte("date_facture", adv.dateDu);
    if (adv.dateAu) query = query.lte("date_facture", adv.dateAu);
    if (adv.montantMin !== undefined) query = query.gte("montant_total", adv.montantMin);
    if (adv.montantMax !== undefined) query = query.lte("montant_total", adv.montantMax);
    return query;
  };

  const from = (page - 1) * pageSize;
  let pageQuery: any = supabase.from("factures").select("*", { count: "estimated" });
  pageQuery = applyFilters(pageQuery);
  const { data: items, error: pageErr, count } = await pageQuery
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (pageErr) throw pageErr;

  // Totaux globaux sur les mêmes filtres
  let sumQuery: any = supabase.from("factures").select("montant_total, montant_paye");
  sumQuery = applyFilters(sumQuery);
  const { data: sumRows, error: sumErr } = await sumQuery;
  if (sumErr) throw sumErr;
  const sumMontantTotal = (sumRows ?? []).reduce(
    (acc: number, r: any) => acc + Number(r.montant_total ?? 0),
    0,
  );
  const sumMontantPaye = (sumRows ?? []).reduce(
    (acc: number, r: any) => acc + Number(r.montant_paye ?? 0),
    0,
  );

  return {
    items: (items ?? []) as Facture[],
    totalCount: count ?? (items?.length ?? 0),
    sumMontantTotal,
    sumMontantPaye,
  };
}

// Les écritures directes `createFacture` / `updateFacture` ont été supprimées :
// elles contournaient les invariants des RPC (`valider_commande`,
// `enregistrer_paiement`, `annuler_paiement`) et pouvaient désynchroniser
// `factures.montant_paye` de la somme réelle des paiements.



/** @deprecated Utiliser `deleteFactureDefinitif` — la suppression directe est réservée au super_admin. */
export async function deleteFacture(id: string, motif?: string) {
  return deleteFactureDefinitif(id, motif);
}

/**
 * Suppression définitive d'une facture (Super Administrateur uniquement).
 * Bloqué côté RPC si la facture est payée, partiellement payée, comporte des
 * paiements enregistrés ou a déjà été transmise à la FNE.
 */
export async function deleteFactureDefinitif(id: string, motif?: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("factures.supprimer");
  const { error } = await supabase.rpc("supprimer_facture_definitif", {
    _facture_id: id,
    _motif: motif ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export async function getFacture(id: string) {
  const { data, error } = await supabase
    .from("factures")
    .select("*")
    .eq("facture_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Facture | null;
}

export async function getFacturePaiements(factureId: string) {
  const { data, error } = await supabase
    .from("paiements")
    .select("paiement_id, reference, date_paiement, montant, mode_paiement, statut")
    .eq("facture_id", factureId)
    .order("date_paiement", { ascending: false });
  if (error) throw error;
  return (data ?? []) as {
    paiement_id: string;
    reference: string;
    date_paiement: string;
    montant: number;
    mode_paiement: string;
    statut: string;
  }[];
}

// ============================================================================
// Lignes d'une facture
// ============================================================================
export async function getFactureLignes(factureId: string) {
  const { data: facture } = await supabase
    .from("factures")
    .select("commande_id")
    .eq("facture_id", factureId)
    .maybeSingle();

  if (!facture?.commande_id) return [];

  const { data, error } = await supabase
    .from("commande_lignes")
    .select("designation, quantite, prix_unitaire, total_ligne, remise_pct, montant_remise, total_ht_ligne, reference_produit, ligne_id")
    .eq("commande_id", facture.commande_id);

  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// Retours liés à une facture — permet d'afficher "Retour partiel/total" partout
// où une facture est présentée (liste, détail, état de compte).
// ============================================================================

export type FactureRetourInfo = {
  retour_id: string;
  reference: string;
  date_retour: string;
  montant: number;
  quantite: number;
  motif: string | null;
  statut: string;
};

export type FactureRetourStatus = "aucun" | "partiel" | "total";

export type FactureRetourResume = {
  retours: FactureRetourInfo[];
  totalMontantRetour: number;
  totalQuantiteRetour: number;
  status: FactureRetourStatus;
};

/** Retours (valides) rattachés à une liste de factures. */
export async function getRetoursByFactureIds(
  factureIds: string[],
): Promise<Record<string, FactureRetourInfo[]>> {
  if (factureIds.length === 0) return {};
  const CHUNK = 100;
  const out: Record<string, FactureRetourInfo[]> = {};
  for (let i = 0; i < factureIds.length; i += CHUNK) {
    const batch = factureIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("retours")
      .select("retour_id, reference, date_retour, montant, total_quantite, motif, statut, facture_id")
      .in("facture_id", batch)
      .neq("statut", "annule")
      .order("date_retour", { ascending: true });
    if (error) throw error;
    for (const r of data ?? []) {
      const fid = (r as any).facture_id as string | null;
      if (!fid) continue;
      (out[fid] ||= []).push({
        retour_id: (r as any).retour_id,
        reference: (r as any).reference,
        date_retour: (r as any).date_retour,
        montant: Number((r as any).montant ?? 0),
        quantite: Number((r as any).total_quantite ?? 0),
        motif: (r as any).motif ?? null,
        statut: (r as any).statut,
      });
    }
  }
  return out;
}

/** Calcule le statut retour (aucun/partiel/total) et les totaux. */
export function computeRetourResume(
  montantFactureNet: number,
  retours: FactureRetourInfo[],
): FactureRetourResume {
  const totalMontantRetour = retours.reduce((s, r) => s + Number(r.montant ?? 0), 0);
  const totalQuantiteRetour = retours.reduce((s, r) => s + Number(r.quantite ?? 0), 0);
  // Le montant net de la facture (montant_total en base) est déjà diminué des retours.
  // Le montant "brut" (facturé à l'origine) = net + total retours.
  const brut = Number(montantFactureNet ?? 0) + totalMontantRetour;
  let status: FactureRetourStatus = "aucun";
  if (retours.length > 0) {
    // "Total" si le net résiduel est ~nul (le retour couvre toute la facture d'origine).
    status = Number(montantFactureNet ?? 0) <= 0.5 || totalMontantRetour >= brut - 0.5
      ? "total"
      : "partiel";
  }
  return { retours, totalMontantRetour, totalQuantiteRetour, status };
}

export const RETOUR_STATUS_META: Record<FactureRetourStatus, { label: string; color: string }> = {
  aucun: { label: "Aucun retour", color: "#94A3B8" },
  partiel: { label: "Retour partiel", color: "#F97316" },
  total: { label: "Retour total", color: "#EF4444" },
};

/** Détail unique — variante scoped à une seule facture. */
export async function getFactureRetours(factureId: string): Promise<FactureRetourInfo[]> {
  const map = await getRetoursByFactureIds([factureId]);
  return map[factureId] ?? [];
}