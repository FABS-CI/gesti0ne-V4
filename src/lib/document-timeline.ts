export type TimelineEvent = {
  occurred_at: string;
  kind: string;
  label: string;
  actor_name: string | null;
  ref: string | null;
};

const KIND_LABEL: Record<string, string> = {
  creation: "Création",
  modification: "Modification",
  statut: "Statut",
  suppression: "Suppression",
  paiement: "Paiement",
  annulation_paiement: "Annulation de paiement",
  envoi: "Envoi",
  fne: "DGI",
  retour: "Retour",
  colis: "Colis",
  livraison: "Livraison",
  note: "Note",
  etape: "Étape",
  lien: "Document lié",
  repartition: "Répartition",
  renommage: "Renommage",
  interaction: "Contact",
};

/** Libellé métier d'un type d'événement ; type inconnu affiché « Autre ». */
export function timelineKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Autre";
}

const VALUE_LABEL: Record<string, string> = {
  accepted: "acceptée",
  rejected: "rejetée",
  pending: "en attente",
  submitted: "soumise",
  signed: "signée",
  certified: "certifiée",
  error: "en erreur",
  failed: "en échec",
  cancelled: "annulée",
  livraison: "Livraison",
  retrait: "Retrait",
  enlevement: "Enlèvement",
  en_preparation: "En préparation",
  prepare: "Préparé",
  expedie: "Expédié",
  en_cours: "En cours",
  en_route: "En route",
  livre: "Livré",
  livree: "Livrée",
  retourne: "Retourné",
  annule: "Annulé",
};

/** Traduit les valeurs techniques (statuts DGI, colis, livraison, mode de transport) en libellés lisibles. */
export function humanizeTimelineLabel(label: string): string {
  return label.replace(/\b[a-z][a-z_]*\b/g, (w) => VALUE_LABEL[w] ?? w);
}
