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
};

/** Libellé métier d'un type d'événement ; type inconnu affiché « Autre ». */
export function timelineKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Autre";
}
