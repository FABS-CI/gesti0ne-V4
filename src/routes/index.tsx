import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * ============================================================================
 * AUDIT COMPLET DU WORKFLOW MÉTIER (LOGIQUE, STOCKS, COMPTABILITÉ)
 * ============================================================================
 * 
 * 1. CARTOGRAPHIE DU WORKFLOW
 * ---------------------------
 * Client -> [PROFORMA] -> COMMANDE (En attente) -> [VALIDATION] 
 *   -> FACTURATION (Génération FAC + Écritures Compta)
 *   -> LOGISTIQUE (Génération BL + Réservation/Mouvement Stock)
 *   -> COLISAGE (Préparation + Étiquetage)
 *   -> LIVRAISON (Tournée + Expédition + Remise)
 *   -> PAIEMENT (Imputation + Mise à jour Solde)
 * 
 * 2. LOGIQUE MÉTIER & POINTS CRITIQUES
 * ------------------------------------
 * - PRÉREQUIS : Tout document doit être rattaché à un Client et un Exercice ouvert.
 * - VALIDATION : Déclencheur unique (RPC: valider_commande).
 * - CALCULS :
 *   * HT Brut = Somme(Qte * PU)
 *   * HT Net = HT Brut - Remises Lignes - Remise Globale
 *   * TTC = HT Net + TVA (calculée sur le net)
 * 
 * 3. MOUVEMENTS DE STOCK (DÉSTOCKAGE)
 * -----------------------------------
 * - MOMENT : Uniquement lors de la VALIDATION de la commande.
 * - FONCTION : rpc.valider_commande -> rpc.ajuster_stock_depot.
 * - TABLES : stocks_depots (quantite), stock_mouvements (historique).
 * - SÉCURITÉ : Un BL/Facture ne peut être généré qu'après déstockage réussi.
 * 
 * 4. ÉCRITURES COMPTABLES & FINANCE
 * -------------------------------
 * - MOMENT : Génération de la Facture (Ventes) ou Validation Compta du Retour (Retours).
 * - JOURNAUX : Ventes (VT) pour factures/avoirs, OD pour retours simples sans avoir.
 * - COMPTES RETOUR : 701 (Ventes) Debit / 411 (Client) Credit (Inversion de vente).
 * - CALCULS RETOUR : Net = (Qte_Recue * PU) - Remises. Impact sur Solde Client ou Avoir.
 * 
 * 5. DROITS & ACCÈS (RBAC v3)
 * ---------------------------
 * - ADMINISTRATEUR : Accès total, suppressions définitives, audit.
 * - COMMERCIAL : Création/Modification (avant validation).
 * - MAGASINIER : Colisage, Inventaires, Réceptions.
 * - LIVREUR : Suivi des tournées, validation BL.
 * - COMPTABILITÉ : Facturation, Paiements, États financiers.
 * 
 * 6. MODULE RETOURS (RÉINTÉGRATION ET AVOIRS)
 * -------------------------------------------
 * - WORKFLOW : Demande -> Attente Magasin -> Réceptionné (Stock+) -> Attente Compta -> Clôturé (Finances).
 * - STOCK : Réintégré lors de la RÉCEPTION (statut 'attente_validation_compta') via rpc.retour_receptionner.
 * - COMPTABILITÉ : Impact financier lors de la VALIDATION COMPTA via rpc.retour_valider_compta.
 *   - Options : Diminution solde client, Création Facture d'Avoir, ou Simple note.
 * - SÉCURITÉ : Validation par rôle (Magasinier pour réception, Comptable pour validation).
 */

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "GESTI0NE — Gestion EDITIONS FABS-CI" },
    { name: "description", content: "Gestion commerciale, retours, comptabilité et paie des EDITIONS FABS-CI." },
    { property: "og:title", content: "GESTI0NE — Gestion EDITIONS FABS-CI" },
    { property: "og:description", content: "Gestion commerciale, retours, comptabilité et paie des EDITIONS FABS-CI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => {
    // Redirection automatique vers le tableau de bord en production
    return <Navigate to="/dashboard" />;
  },
});
