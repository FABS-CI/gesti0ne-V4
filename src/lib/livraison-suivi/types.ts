export type LivType = "direct" | "expedition";
/** Type d'une tournée : peut contenir uniquement des livraisons directes,
 *  uniquement des expéditions, ou les deux (« mixte »). Les commandes
 *  rattachées gardent toujours leur propre type (direct ou expedition). */
export type TourneeType = LivType | "mixte";

export type LivStatut =
  | "preparee"
  | "chargee"
  | "en_route"
  | "remise_livreur"
  | "depart_depot"
  | "arrive_client"
  | "livree"
  | "reception_confirmee"
  | "non_livre"
  | "remise_transporteur"
  | "expediee"
  | "arrivee_gare"
  | "retiree_client"
  | "livree_locale";

/**
 * Représentation minimale d'une tournée telle qu'elle est jointe aux lignes
 * de suivi de livraison. Depuis la refonte du workflow (colisage → tournée →
 * suivi), les tournées vivent dans la table `tournees` et non plus dans
 * `livsuivi_tournees` (supprimée).
 */
/**
 * Représentation minimale d'une tournée telle qu'elle est jointe aux lignes
 * de suivi de livraison. Depuis la refonte du workflow (colisage → tournée →
 * suivi), les tournées vivent dans la table `tournees` (l'ancienne table
 * `livsuivi_tournees` a été supprimée). Les noms de champs `livreur_nom`
 * et `vehicule` sont préservés en tant qu'alias pour ne pas casser les
 * consommateurs (`LivraisonsTable`, `livraison-suivi.$commandeRef`, etc.).
 */
export type LivTournee = {
  tournee_id: string;
  reference: string | null;
  statut: string | null;
  date_depart: string | null;
  livreur_nom: string | null;
  vehicule: string | null;
};

export type LivSuiviCommande = {
  id: string;
  commande_id: string;
  tournee_id: string | null;
  type_livraison: LivType;
  gare_depot: string | null;
  gare_destination: string | null;
  ville_destination: string | null;
  livreur_nom: string | null;
  vehicule: string | null;
  receptionnaire_nom: string | null;
  statut: LivStatut;
  derniere_maj: string;
  cloturee: boolean;
  created_at: string;
  updated_at: string;
  ordre_passage?: number | null;
  point_livraison?: string | null;
  heure_depart?: string | null;
  heure_arrivee?: string | null;
  heure_livraison?: string | null;
  receptionnaire_telephone?: string | null;
  signature_url?: string | null;
  photo_preuve_url?: string | null;
  commentaire_reception?: string | null;
  retour_motif?: string | null;
  nb_cartons?: number | null;
  commande?: {
    reference: string;
    client_id?: string | null;
    client_nom: string | null;
    ville: string | null;
    telephone: string | null;
    adresse?: string | null;
    montant_total: number | null;
  } | null;
  tournee?: LivTournee | null;
};

export type LivHistorique = {
  id: string;
  livraison_id: string;
  etape: LivStatut;
  commentaire: string | null;
  meta: Record<string, unknown>;
  user_nom: string | null;
  created_at: string;
};

export type ColisInfo = {
  reference: string | null;
  numero_carton: number | null;
  nb_cartons: number | null;
  contenu: string | null;
  destinataire: string | null;
  transporteur: string | null;
  date_envoi: string | null;
  poids: number | null;
  bl_reference: string | null;
  bl_date_livraison: string | null;
  depot_nom: string | null;
  nb_colis: number;
  livreur_nom: string | null;
  livreur_telephone: string | null;
  vehicule: string | null;
  gare_depart: string | null;
  gare_responsable: string | null;
  gare_telephone: string | null;
  ville_destination: string | null;
  ville_livraison: string | null;
  quartier: string | null;
  commune: string | null;
  mode_acheminement: string | null;
};
