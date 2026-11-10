import type { StatusTone } from "@/components/common/StatusPill";

/** Ton de pastille pour les statuts de facture (affichage seulement). */
export const FACTURE_STATUT_TONE: Record<string, StatusTone> = {
  impayee: "danger",
  partielle: "warning",
  payee: "success",
  annulee: "neutral",
  avoir: "info",
};

/** Ton générique à partir d'un code de statut (listes diverses). */
export function toneForStatut(statut: string | null | undefined): StatusTone {
  const s = (statut ?? "").toLowerCase();
  if (/(attente|annulation)/.test(s)) return "warning";
  if (/(expir)/.test(s)) return "neutral";
  if (/(resili|résili)/.test(s)) return "danger";
  if (/(inactif|non_pay|impay)/.test(s)) return s.includes("inactif") ? "neutral" : "danger";
  if (/(pay|valid|livr|actif|accept|termin|recu|reçu|confirm|soldé|solde)/.test(s)) return "success";
  if (/(partiel|attente|cours|prepar|prépar|envoy|brouillon)/.test(s)) {
    return s.includes("brouillon") ? "neutral" : "warning";
  }
  if (/(impay|retard|rejet|refus|erreur|echec|échec)/.test(s)) return "danger";
  if (/(annul|inactif|archiv|clos)/.test(s)) return "neutral";
  return "info";
}
