export type TourneeCout = {
  tournee_id: string;
  reference: string;
  date_tournee: string | null;
  chauffeur_nom: string | null;
  responsable_nom: string | null;
  vehicule_id: string | null;
  vehicules?: { immatriculation: string | null } | null;
  statut: string;
  type_tournee: string | null;
  validation_statut: string;
  mode_reglement: string | null;
  validation_at: string | null;
  validation_commentaire: string | null;
  nb_clients: number;
  nb_colis: number;
  nb_cartons: number;
  cout_carburant: number;
  cout_peages: number;
  cout_repas: number;
  cout_manutentions: number;
  cout_livraison: number;
  cout_expeditions: number;
  cout_autres: number;
  cout_total: number | null;
  ecriture_id: string | null;
};

export const VALIDATION_STATUTS = [
  { value: "brouillon", label: "En attente de validation", color: "amber" },
  { value: "en_attente", label: "En attente de validation", color: "amber" },
  { value: "valide", label: "Validé", color: "blue" },
  { value: "refuse", label: "Refusé", color: "red" },
  { value: "annule", label: "Annulé", color: "gray" },
  { value: "decaisse", label: "Décaissement effectué", color: "green" },
] as const;


export const TYPES = [
  { value: "livraison", label: "Livraison" },
  { value: "expedition", label: "Expédition" },
  { value: "mixte", label: "Mixte" },
];

export const CATEGORIES: Array<{ key: keyof TourneeCout; label: string }> = [
  { key: "cout_carburant", label: "Carburant" },
  { key: "cout_peages", label: "Péages" },
  { key: "cout_repas", label: "Repas" },
  { key: "cout_manutentions", label: "Manutentions" },
  { key: "cout_livraison", label: "Livraison" },
  { key: "cout_expeditions", label: "Expéditions" },
  { key: "cout_autres", label: "Autres" },
];

export function statutMeta(v: string) {
  return VALIDATION_STATUTS.find((s) => s.value === v) ?? VALIDATION_STATUTS[0];
}

export function startOf(period: "day" | "week" | "month" | "year"): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "day") return d;
  if (period === "week") {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}
