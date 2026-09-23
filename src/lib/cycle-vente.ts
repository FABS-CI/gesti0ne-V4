import { supabase } from "@/integrations/supabase/client";
import type { Commande } from "@/lib/commandes-api";
import { ensureCertificationSafe } from "@/lib/certification/auto-certify";

/**
 * Chaînage du cycle de vente :
 * Proforma → Commande → Bon de livraison → Facture
 * Toutes les conversions multi-tables passent par des RPC PostgreSQL
 * atomiques (transactions), ce qui garantit qu'un échec en cours annule
 * intégralement l'opération (pas de données à moitié créées).
 */


/** Convertit une proforma en commande via RPC atomique. */
export async function createCommandeFromProforma(proformaId: string): Promise<Commande> {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("proformas.convertir_en_commande");
  const { data: commandeId, error } = await supabase.rpc("convertir_proforma_en_commande", {
    _proforma_id: proformaId,
  } as never);
  if (error) throw new Error(error.message);

  const { data, error: eGet } = await supabase
    .from("commandes")
    .select("*")
    .eq("commande_id", commandeId as unknown as string)
    .single();
  if (eGet) throw eGet;
  const commande = data as Commande;
  // Certification automatique du bon de commande créé.
  await ensureCertificationSafe(commande.reference);
  return commande;
}

export type ColisageInput = {
  nb_colis: number;
  poids_total?: number | null;
  dimensions?: string | null;
  transporteur?: string | null;
  adresse_livraison?: string | null;
  signataire?: string | null;
  date_livraison?: string | null;
  decrementer_stock?: boolean;
};

/**
 * Conversion Commande → BL + colisage + mouvements stock via RPC atomique.
 * Toutes les écritures (bon de livraison, ordre de colisage, colis, sorties
 * de stock, statut commande) se font dans une même transaction serveur.
 */
export async function convertirCommandeEnBL(commande: Commande, colisage: ColisageInput) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.convertir_en_bl");
  const { data, error } = await supabase.rpc("convertir_commande_en_bl", {
    _commande_id: commande.commande_id,
    _nb_colis: colisage.nb_colis,
    _poids_total: colisage.poids_total ?? null,
    _transporteur: colisage.transporteur ?? null,
    _adresse_livraison: colisage.adresse_livraison ?? null,
    _signataire: colisage.signataire ?? null,
    _date_livraison: colisage.date_livraison ?? null,
    _decrementer_stock: colisage.decrementer_stock !== false,
  } as never);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as { bl_id: string; reference: string };
}

/**
 * Crée la facture définitive à partir d'une commande.
 *
 * Lot B : l'insertion directe est supprimée pour éviter les doublons.
 * On délègue à la RPC atomique `valider_commande` qui gère en une seule
 * transaction : contrôle stock, décrément stock, création facture, création BL.
 * Si la commande a déjà une facture non annulée, elle est renvoyée telle quelle.
 */
export async function createFactureFromCommande(commande: Commande) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("commandes.generer_facture");

  const { data: existing } = await supabase
    .from("factures")
    .select("facture_id, reference")
    .eq("commande_id", commande.commande_id)
    .neq("statut", "annulee")
    .limit(1);
  if (existing && existing.length > 0) {
    await ensureCertificationSafe(existing[0].reference);
    return existing[0];
  }

  const { data, error } = await supabase.rpc("valider_commande", {
    _commande_id: commande.commande_id,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const reference = (row as { facture_reference?: string })?.facture_reference ?? "";
  await ensureCertificationSafe(reference);
  return { reference };
}

export type FraisTransport = {
  /** null = aucun frais de transport (cas par défaut). */
  type: "livraison" | "expedition" | null;
  montant: number | null;
};

/**
 * Valide une commande (rôle requis) :
 * - passe la commande au statut "validee"
 * - enregistre les frais de transport éventuels (un seul type, ou aucun)
 * - crée la facture définitive
 * - crée le bon de livraison
 * Tout est fait de manière atomique côté DB via la fonction `valider_commande`.
 */
export async function validerCommande(commandeId: string, frais?: FraisTransport) {
  const type = frais?.type ?? null;
  const montant = type ? Number(frais?.montant ?? 0) : null;
  if (type && (montant === null || Number.isNaN(montant) || montant < 0)) {
    throw new Error("Montant des frais de transport invalide");
  }
  const { data, error } = await supabase.rpc("valider_commande", {
    _commande_id: commandeId,
    _type_frais_transport: type,
    _montant_frais_transport: montant,
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const res = row as { facture_reference: string; bl_reference: string };
  // Certification automatique de la facture issue de la validation.
  await ensureCertificationSafe(res.facture_reference);
  return res;
}
