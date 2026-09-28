import { supabase } from "@/integrations/supabase/client";
import { getDepotDefautId } from "@/lib/parametres-api";
import { assertPermission } from "@/lib/rbac-api";

/** Options de validation comptable. */
export type ValidationComptaOption =
  | "diminuer_solde"
  | "creer_avoir"
  | "preparer_remboursement"
  | "aucun_impact";

/** Statuts officiels (valeurs stockées en base). */
export const STATUTS_RETOUR = [
  { value: "demande_creee", label: "En attente validation", color: "#6366F1" },
  { value: "attente_reception", label: "En attente magasin", color: "#F97316" },
  { value: "receptionne", label: "Réceptionné", color: "#0EA5E9" },
  { value: "attente_validation_compta", label: "En attente compta", color: "#F59E0B" },
  { value: "valide_compta", label: "Validé compta", color: "#10B981" },
  { value: "cloture", label: "Clôturé", color: "#047857" },
  { value: "refus_magasin", label: "Refusé", color: "#EF4444" },
  { value: "refus_compta", label: "Refusé (compta)", color: "#DC2626" },
  { value: "annule", label: "Annulé", color: "#6B7280" },
] as const;

/** Anciens libellés encore présents sur des enregistrements historiques. */
const STATUTS_LEGACY: Array<{ value: string; label: string; color: string }> = [
  { value: "en_cours", label: "En cours", color: "#F59E0B" },
  { value: "accepte", label: "Accepté", color: "#10B981" },
  { value: "valide", label: "Validé", color: "#10B981" },
  { value: "en_attente_magasin", label: "En attente magasin", color: "#F97316" },
  { value: "en_attente_compta", label: "En attente compta", color: "#F59E0B" },
  { value: "refuse_magasin", label: "Refusé (magasin)", color: "#EF4444" },
  { value: "refuse_compta", label: "Refusé (compta)", color: "#DC2626" },
];

/** Motifs de retour normalisés (liste contrôlée). */
export const MOTIFS_RETOUR = [
  { value: "defectueux", label: "Produit défectueux" },
  { value: "erreur_commande", label: "Erreur de commande" },
  { value: "surplus", label: "Surplus / invendu" },
  { value: "non_conforme", label: "Article non conforme" },
  { value: "retard", label: "Livraison hors délai" },
  { value: "autre", label: "Autre motif" },
] as const;

export const MOTIF_RETOUR_LABEL: Record<string, string> = Object.fromEntries(
  MOTIFS_RETOUR.map((m) => [m.value, m.label]),
);

/** État du produit retourné (impacte le stock à la réception). */
export const ETATS_PRODUIT_RETOUR = [
  { value: "revendable", label: "Revendable" },
  { value: "endommage", label: "Endommagé" },
  { value: "perdu", label: "Perdu" },
] as const;

export const ETAT_PRODUIT_LABEL: Record<string, string> = Object.fromEntries(
  ETATS_PRODUIT_RETOUR.map((e) => [e.value, e.label]),
);

export const STATUT_RETOUR_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(
    [...STATUTS_RETOUR, ...STATUTS_LEGACY].map((s) => [s.value, { label: s.label, color: s.color }]),
  );

export type RetourStatut = (typeof STATUTS_RETOUR)[number]["value"];

export type Retour = {
  retour_id: string;
  reference: string;
  numero: string | null;
  date_retour: string;
  type_retour: "physique" | "avoir";
  client_id: string | null;
  client_nom: string | null;
  etablissement: string | null;
  representant_nom: string | null;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  depot_id: string | null;
  total_quantite: number;
  nb_produits: number;
  observations: string | null;
  notes: string | null;
  motif: string | null;
  statut: string;
  facture_id: string | null;
  livraison_id: string | null;
  commande_id: string | null;
  montant: number;
  created_by: string | null;
  created_by_nom: string | null;
  created_at: string;
  updated_at: string;
  // Workflow v2
  receptionne_par?: string | null;
  receptionne_par_nom?: string | null;
  receptionne_at?: string | null;
  valide_compta_par?: string | null;
  valide_compta_par_nom?: string | null;
  valide_compta_at?: string | null;
  motif_refus_magasin?: string | null;
  motif_refus_compta?: string | null;
  version_no?: number | null;
  workflow_approval_id?: string | null;
};

export type RetourLigne = {
  ligne_id: string;
  retour_id: string;
  produit_id: string | null;
  reference_produit: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct?: number | null;
  montant_brut?: number | null;
  remise_montant?: number | null;
  total_ligne: number;
  motif: string | null;
  etat_produit?: string | null;
  created_at: string;
  quantite_demandee?: number | null;
  quantite_recue?: number | null;
  etat_reception?: string | null;
  commentaire_reception?: string | null;
};

export type RetourWithLignes = Retour & { lignes: RetourLigne[] };

export type RetourLigneInput = {
  produit_id: string;
  reference_produit?: string | null;
  designation: string;
  quantite: number;
  prix_unitaire?: number | null;
  remise_pct?: number | null;
  etat_produit?: string | null;
  motif?: string | null;
};

export type RetourInput = {
  date_retour?: string;
  client_id: string;
  type_retour?: "physique" | "avoir";
  etablissement?: string | null;
  representant_nom?: string | null;
  telephone?: string | null;
  ville?: string | null;
  adresse?: string | null;
  depot_id?: string | null;
  observations?: string | null;
  notes?: string | null;
  facture_id?: string | null;
  livraison_id?: string | null;
  lignes: RetourLigneInput[];
};

export type ListRetoursParams = {
  q?: string;
  statut?: string;
  client_id?: string;
  ville?: string;
  representant?: string;
  date_debut?: string;
  date_fin?: string;
  exerciceId?: string | null;
};

export async function listRetours(params: ListRetoursParams = {}): Promise<Retour[]> {
  let query = supabase
    .from("retours")
    .select("*")
    .order("date_retour", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.exerciceId) query = query.eq("exercice_id", params.exerciceId);
  if (params.statut && params.statut !== "all") query = query.eq("statut", params.statut);
  if (params.client_id) query = query.eq("client_id", params.client_id);
  if (params.ville) query = query.ilike("ville", `%${params.ville}%`);
  if (params.representant) query = query.ilike("representant_nom", `%${params.representant}%`);
  if (params.date_debut) query = query.gte("date_retour", params.date_debut);
  if (params.date_fin) query = query.lte("date_retour", params.date_fin);
  if (params.q && params.q.trim()) {
    const t = `%${params.q.trim()}%`;
    query = query.or(
      `numero.ilike.${t},reference.ilike.${t},etablissement.ilike.${t},client_nom.ilike.${t},representant_nom.ilike.${t},ville.ilike.${t}`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Retour[];
}

export async function getRetour(id: string): Promise<RetourWithLignes | null> {
  const { data, error } = await supabase
    .from("retours")
    .select("*")
    .eq("retour_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: lignes, error: errL } = await supabase
    .from("retour_lignes")
    .select("*")
    .eq("retour_id", id)
    .order("created_at", { ascending: true });
  if (errL) throw errL;
  return { ...(data as Retour), lignes: (lignes ?? []) as RetourLigne[] };
}

// `creerRetour` (RPC historique `creer_retour`, statut « accepte ») a été retiré :
// le workflow v2 à 9 statuts passe désormais par `creerRetourDemande` puis
// réception magasin et validation comptable.


export async function annulerRetour(id: string): Promise<void> {
  await assertPermission("retours.annuler");
  const { error } = await (
    supabase as unknown as {
      rpc: (name: string, args: { _retour_id: string }) => Promise<{ error: Error | null }>;
    }
  ).rpc("annuler_retour", { _retour_id: id });
  if (error) throw error;
}

/** Suppression définitive — réservée aux super administrateurs. */
export async function supprimerRetour(id: string): Promise<void> {
  const { error } = await (
    supabase as unknown as {
      rpc: (name: string, args: { _retour_id: string }) => Promise<{ error: Error | null }>;
    }
  ).rpc("supprimer_retour_definitif", { _retour_id: id });
  if (error) throw error;
}

// ============================================================================
// Lot 1 — Retour rattaché à une facture
// ============================================================================

export type LigneRetournable = {
  produit_id: string;
  reference_produit: string | null;
  designation: string;
  qte_vendue: number;
  qte_deja_retournee: number;
  qte_disponible: number;
  prix_unitaire: number;
  remise_pct: number;
  total_ligne: number;
};

export async function getLignesRetournables(factureId: string): Promise<LigneRetournable[]> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: { _facture_id: string },
      ) => Promise<{ data: unknown; error: Error | null }>;
    }
  ).rpc("get_lignes_retournables", { _facture_id: factureId });
  if (error) throw error;
  return (data ?? []) as LigneRetournable[];
}

export type FactureRetourOption = {
  facture_id: string;
  reference: string;
  date_facture: string;
  montant_total: number;
  statut: string;
};

export async function searchFacturesClient(
  clientId: string,
  q?: string,
): Promise<FactureRetourOption[]> {
  let query = supabase
    .from("factures")
    .select("facture_id,reference,date_facture,montant_total,statut")
    .eq("client_id", clientId)
    .not("commande_id", "is", null)
    .neq("statut", "annulee")
    .order("date_facture", { ascending: false })
    .limit(20);
  if (q && q.trim()) query = query.ilike("reference", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FactureRetourOption[];
}

// ============================================================================
// Workflow v2 — Retours (moteur d'approbation transversal)
// ============================================================================

export type CreerRetourDemandePayload = RetourInput & {
  niveau_urgence?: "normal" | "urgent" | "critique";
  motif?: string | null;
};

/** Crée une demande de retour (workflow v2, magasin en attente). */
export async function creerRetourDemande(input: CreerRetourDemandePayload): Promise<string> {
  await assertPermission("retours.creer");
  const type_retour = input.type_retour ?? "physique";
  const depot_id =
    type_retour === "avoir" ? null : (input.depot_id ?? (await getDepotDefautId()));
  const payload = {
    date_retour: input.date_retour ?? new Date().toISOString().slice(0, 10),
    client_id: input.client_id,
    type_retour,
    etablissement: input.etablissement ?? null,
    representant_nom: input.representant_nom ?? null,
    telephone: input.telephone ?? null,
    ville: input.ville ?? null,
    adresse: input.adresse ?? null,
    depot_id,
    observations: input.observations ?? null,
    notes: input.notes ?? null,
    facture_id: input.facture_id ?? null,
    livraison_id: input.livraison_id ?? null,
    niveau_urgence: input.niveau_urgence ?? "normal",
    motif: input.motif ?? null,
    lignes: input.lignes.map((l) => ({
      produit_id: l.produit_id,
      reference_produit: l.reference_produit ?? null,
      designation: l.designation,
      quantite: l.quantite,
      quantite_demandee: l.quantite,
      prix_unitaire: l.prix_unitaire ?? 0,
      remise_pct: l.remise_pct ?? 0,
      etat_produit: l.etat_produit ?? "revendable",
      motif: l.motif ?? null,
    })),
  };
  const { data, error } = await (
    supabase as unknown as {
      rpc: (n: string, a: { _payload: unknown }) => Promise<{ data: unknown; error: Error | null }>;
    }
  ).rpc("retour_creer_demande", { _payload: payload });
  if (error) throw error;
  return data as string;
}

/** Nouveau parcours : crée le retour ET le traite entièrement côté serveur (atomique). */
export async function creerEtValiderRetour(input: CreerRetourDemandePayload): Promise<string> {
  await assertPermission("retours.creer");
  const type_retour = input.type_retour ?? "physique";
  const depot_id =
    type_retour === "avoir" ? null : (input.depot_id ?? (await getDepotDefautId()));
  const payload = {
    date_retour: input.date_retour ?? new Date().toISOString().slice(0, 10),
    client_id: input.client_id,
    type_retour,
    etablissement: input.etablissement ?? null,
    representant_nom: input.representant_nom ?? null,
    telephone: input.telephone ?? null,
    ville: input.ville ?? null,
    adresse: input.adresse ?? null,
    depot_id,
    observations: input.observations ?? null,
    notes: input.notes ?? null,
    facture_id: input.facture_id ?? null,
    livraison_id: input.livraison_id ?? null,
    niveau_urgence: input.niveau_urgence ?? "normal",
    motif: input.motif ?? null,
    lignes: input.lignes.map((l) => ({
      produit_id: l.produit_id,
      reference_produit: l.reference_produit ?? null,
      designation: l.designation,
      quantite: l.quantite,
      quantite_demandee: l.quantite,
      prix_unitaire: l.prix_unitaire ?? 0,
      remise_pct: l.remise_pct ?? 0,
      etat_produit: l.etat_produit ?? "revendable",
      motif: l.motif ?? null,
    })),
  };
  const { data, error } = await (
    supabase as unknown as {
      rpc: (n: string, a: { _payload: unknown }) => Promise<{ data: unknown; error: Error | null }>;
    }
  ).rpc("retour_creer_et_valider", { _payload: payload });
  if (error) throw error;
  return data as string;
}

export type ReceptionLigneInput = {
  ligne_id: string;
  quantite_recue: number;
  etat_reception?: "conforme" | "endommage" | "manquant" | "refuse";
  commentaire_reception?: string | null;
};

/** Réception physique par le magasin — impacte le stock. */
export async function receptionnerRetour(args: {
  retour_id: string;
  version: number;
  lignes: ReceptionLigneInput[];
}): Promise<void> {
  await assertPermission("retours.receptionner");
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _retour_id: string; _version: number; _lignes: unknown },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("retour_receptionner", {
    _retour_id: args.retour_id,
    _version: args.version,
    _lignes: args.lignes,
  });
  if (error) throw error;
}

export async function refuserRetourMagasin(args: {
  retour_id: string;
  version: number;
  motif: string;
}): Promise<void> {
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _retour_id: string; _version: number; _motif: string },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("retour_refuser_magasin", {
    _retour_id: args.retour_id,
    _version: args.version,
    _motif: args.motif,
  });
  if (error) throw error;
}

export async function refuserRetourCompta(args: {
  retour_id: string;
  version: number;
  motif: string;
}): Promise<void> {
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _retour_id: string; _version: number; _motif: string },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("retour_refuser_compta", {
    _retour_id: args.retour_id,
    _version: args.version,
    _motif: args.motif,
  });
  if (error) throw error;
}

export type SimulationFinanciere = {
  montant_total?: number;
  impact_solde?: number;
  avoir_disponible?: number;
  remboursement_possible?: boolean;
  details?: Record<string, unknown>;
  [k: string]: unknown;
};

export async function getRetourSimulation(retour_id: string): Promise<SimulationFinanciere> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _retour_id: string },
      ) => Promise<{ data: unknown; error: Error | null }>;
    }
  ).rpc("retour_simulation_financiere", { _retour_id: retour_id });
  if (error) throw error;
  return (data ?? {}) as SimulationFinanciere;
}



export async function validerRetourCompta(args: {
  retour_id: string;
  version: number;
  option: ValidationComptaOption;
  montants?: Record<string, number>;
  commentaire?: string | null;
}): Promise<void> {
  await assertPermission("retours.valider_compta");
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: {
          _retour_id: string;
          _version: number;
          _option: string;
          _montants: unknown;
          _commentaire: string | null;
        },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("retour_valider_compta", {
    _retour_id: args.retour_id,
    _version: args.version,
    _option: args.option,
    _montants: args.montants ?? {},
    _commentaire: args.commentaire ?? null,
  });
  if (error) throw error;
}

export async function forcerClotureRetour(args: {
  retour_id: string;
  motif: string;
}): Promise<void> {
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _retour_id: string; _motif: string },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("retour_forcer_cloture", { _retour_id: args.retour_id, _motif: args.motif });
  if (error) throw error;
}

export async function rouvrirApprobation(args: {
  approval_id: string;
  motif: string;
}): Promise<void> {
  const { error } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { _approval_id: string; _motif: string },
      ) => Promise<{ error: Error | null }>;
    }
  ).rpc("approbation_rouvrir", { _approval_id: args.approval_id, _motif: args.motif });
  if (error) throw error;
}

// ============================================================================
// Journal d'audit d'un retour
// ============================================================================

export type RetourAuditEntry = {
  id: string;
  action: string;
  created_at: string;
  user_email: string | null;
  details: Record<string, unknown> | null;
};

export async function getRetourHistorique(retourId: string): Promise<RetourAuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, user_email, details")
    .eq("table_name", "retours")
    .eq("record_id", retourId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as RetourAuditEntry[];
}
