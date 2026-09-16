import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

export const MODES_PAIEMENT = [
  { value: "especes", label: "Espèces" },
  { value: "cheque", label: "Chèque" },
  { value: "virement", label: "Virement" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "carte", label: "Carte bancaire" },
] as const;

export const MODE_PAIEMENT_LABEL: Record<string, string> = Object.fromEntries(
  MODES_PAIEMENT.map((m) => [m.value, m.label]),
);

export const STATUTS_PAIEMENT = [
  { value: "valide", label: "Validé", color: "#10B981" },
  { value: "en_attente_validation", label: "En attente de validation", color: "#F59E0B" },
  { value: "en_attente", label: "En attente", color: "#F97316" },
  { value: "rejete", label: "Rejeté", color: "#DC2626" },
  { value: "annule", label: "Annulé", color: "#EF4444" },
] as const;

export const STATUT_PAIEMENT_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_PAIEMENT.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Paiement = {
  paiement_id: string;
  reference: string;
  facture_id: string | null;
  client_nom: string | null;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  statut: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  valide_par?: string | null;
  valide_le?: string | null;
  rejete_par?: string | null;
  rejete_le?: string | null;
  motif_rejet?: string | null;
  commentaire_validation?: string | null;
  cree_par?: string | null;
};


export async function listPaiements(q?: string, statut?: string, exerciceId?: string | null) {
  let query = supabase.from("paiements").select("*");
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (q) query = query.or(`reference.ilike.%${q}%,client_nom.ilike.%${q}%`);
  if (statut) query = query.eq("statut", statut);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Paiement[];
}

export async function listFacturesOptions() {
  const { data, error } = await supabase
    .from("factures")
    .select("facture_id, reference, client_nom")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { facture_id: string; reference: string; client_nom: string | null }[];
}

// Les écritures directes `createPaiement` / `updatePaiement` ont été supprimées :
// tout mouvement de paiement doit passer par les RPC `enregistrer_paiement` /
// `annuler_paiement`, seules garantes de la cohérence des soldes clients.



/** Suppression directe interdite par trigger : passer par `annuler_paiement`. */
export async function deletePaiement(id: string, raison = "annulation", notes?: string) {
  const { error } = await callRpc("annuler_paiement", {
    _paiement_id: id,
    _raison: raison,
    _notes: notes,
  });
  if (error) throw error;
}

/**
 * Suppression DÉFINITIVE d'un paiement — super_admin uniquement.
 * Contourne le garde `trg_paiements_no_delete` côté DB. À réserver aux
 * corrections exceptionnelles (paiement saisi par erreur, doublon).
 */
export async function supprimerPaiementDefinitif(id: string, motif: string) {
  const { error } = await supabase.rpc("supprimer_paiement_definitif", {
    _paiement_id: id,
    _motif: motif,
  });
  if (error) throw error;
}

export async function getPaiement(id: string) {
  const { data, error } = await supabase
    .from("paiements")
    .select("*")
    .eq("paiement_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Paiement | null;
}

// ===== Workflow officiel =====

export type EnregistrerPaiementInput = {
  facture_id: string;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  reference_paiement?: string | null;
  banque?: string | null;
  num_transaction?: string | null;
  observations?: string | null;
  idempotency_key?: string | null;
};

export async function enregistrerPaiement(input: EnregistrerPaiementInput) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("paiements.creer");
  const { data, error } = await callRpc("enregistrer_paiement", {
    _payload: input as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Paiement;
}

export async function annulerPaiement(paiementId: string, raison: string, notes?: string | null) {
  if (!raison || !raison.trim()) {
    throw new Error("Raison d'annulation obligatoire");
  }
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("paiements.annuler");
  const { data, error } = await callRpc("annuler_paiement", {
    _paiement_id: paiementId,
    _raison: raison.trim(),
    _notes: notes?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Paiement;
}

export type PaiementAnnulationAudit = {
  id: string;
  paiement_id: string;
  facture_id: string | null;
  annule_par: string | null;
  annule_le: string;
  raison: string;
  notes: string | null;
  montant_annule: number;
  created_at: string;
  /** Libellés lisibles résolus côté client (référence paiement, nom utilisateur). */
  paiement_reference?: string | null;
  client_nom?: string | null;
  annule_par_nom?: string | null;
};

/** Remplace les identifiants techniques par la référence du paiement et le nom de l'utilisateur. */
async function enrichirAnnulations(rows: PaiementAnnulationAudit[]) {
  if (!rows.length) return rows;
  const paiementIds = [...new Set(rows.map((r) => r.paiement_id).filter(Boolean))];
  const userIds = [...new Set(rows.map((r) => r.annule_par).filter(Boolean))] as string[];

  const [paiementsRes, profilsRes] = await Promise.all([
    paiementIds.length
      ? supabase
          .from("paiements")
          .select("paiement_id, reference, client_nom")
          .in("paiement_id", paiementIds)
      : Promise.resolve({ data: [] as { paiement_id: string; reference: string; client_nom: string | null }[] }),
    userIds.length
      ? supabase.from("profiles").select("id, nom_complet, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; nom_complet: string | null; email: string | null }[] }),
  ]);

  const paiements = new Map(
    (paiementsRes.data ?? []).map((p) => [p.paiement_id, p]),
  );
  const profils = new Map((profilsRes.data ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = paiements.get(r.paiement_id);
    const u = r.annule_par ? profils.get(r.annule_par) : undefined;
    return {
      ...r,
      paiement_reference: p?.reference ?? null,
      client_nom: p?.client_nom ?? null,
      annule_par_nom: u?.nom_complet || u?.email || null,
    };
  });
}

export async function listPaiementAnnulationsAudit(q?: string) {
  let query = supabase
    .from("paiement_annulations_audit")
    .select("*")
    .order("annule_le", { ascending: false });
  if (q && q.trim()) {
    query = query.or(`raison.ilike.%${q}%,notes.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return enrichirAnnulations((data ?? []) as PaiementAnnulationAudit[]);
}

export async function getPaiementAnnulationAudit(id: string) {
  const { data, error } = await supabase
    .from("paiement_annulations_audit")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await enrichirAnnulations([data as PaiementAnnulationAudit]);
  return row as PaiementAnnulationAudit;
}

export type FactureImpayee = {
  facture_id: string;
  reference: string;
  date_facture: string;
  montant_total: number;
  montant_paye: number;
  solde: number;
  statut: string;
};

export async function listFacturesImpayeesClient(clientId: string) {
  const { data, error } = await supabase.rpc("factures_impayees_client", {
    _client_id: clientId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FactureImpayee[];
}

export type RecuContext = {
  paiement: Paiement;
  facture: {
    reference: string | null;
    montant_total: number;
    montant_paye: number;
  } | null;
  client: {
    reference: string | null;
    nom: string | null;
    telephone: string | null;
    adresse: string | null;
    ville: string | null;
    representant: string | null;
  } | null;
};

/** Charge toutes les infos réelles nécessaires au reçu PDF. */
export async function getRecuContext(paiementId: string): Promise<RecuContext & { balanceBefore?: number }> {
  const { data: p, error } = await supabase
    .from("paiements")
    .select("*")
    .eq("paiement_id", paiementId)
    .single();
  if (error) throw error;
  const paiement = p as Paiement;

  let facture: RecuContext["facture"] = null;
  let client: RecuContext["client"] = null;
  let balanceBefore: number | undefined;

  if (paiement.facture_id) {
    const { data: f } = await supabase
      .from("factures")
      .select("reference, montant_total, montant_paye, client_id, client_nom")
      .eq("facture_id", paiement.facture_id)
      .maybeSingle();
    
    if (f) {
      facture = {
        reference: f.reference,
        montant_total: Number(f.montant_total ?? 0),
        montant_paye: Number(f.montant_paye ?? 0),
      };

      // Calcul historique du solde pour les anciens reçus
      // Solde avant = Total Facture - Somme des paiements VALIDÉS strictement antérieurs à celui-ci
      const { data: previousPayments } = await supabase
        .from("paiements")
        .select("montant")
        .eq("facture_id", paiement.facture_id)
        .eq("statut", "valide")
        .or(`date_paiement.lt.${paiement.date_paiement},and(date_paiement.eq.${paiement.date_paiement},created_at.lt.${paiement.created_at})`);
      
      const sumPrevious = (previousPayments ?? []).reduce((acc, curr) => acc + Number(curr.montant), 0);
      balanceBefore = Number(f.montant_total) - sumPrevious;

      if (f.client_id) {
        const { data: c } = await supabase
          .from("clients")
          .select("reference, nom, telephone, adresse, ville, representant")
          .eq("client_id", f.client_id)
          .maybeSingle();
        if (c) {
          client = {
            reference: c.reference,
            nom: c.nom,
            telephone: c.telephone,
            adresse: c.adresse,
            ville: c.ville,
            representant: c.representant,
          };
        }
      }
    }
  }

  // Fallback client par nom si pas rattaché à une facture
  if (!client && paiement.client_nom) {
    const { data: c } = await supabase
      .from("clients")
      .select("reference, nom, telephone, adresse, ville, representant")
      .eq("nom", paiement.client_nom)
      .maybeSingle();
    if (c) {
      client = {
        reference: c.reference,
        nom: c.nom,
        telephone: c.telephone,
        adresse: c.adresse,
        ville: c.ville,
        representant: c.representant,
      };
    }
  }

  return { paiement, facture, client, balanceBefore };
}
