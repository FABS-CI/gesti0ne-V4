import { formatFCFA } from '@/lib/format';

export type PaiementDette = { solde: number; reserve: number; disponible: number };

export function paiementDetteMessage(dette: PaiementDette, montant: number, selection?: number): string | null {
  if (dette.solde <= 0) return "Paiement impossible : ce client ne présente aucun solde débiteur. Aucun paiement supplémentaire n'est autorisé.";
  const disponible = Math.min(dette.disponible, selection ?? dette.disponible);
  if (montant > disponible) return `Paiement refusé : le montant saisi dépasse le solde restant dû. Montant dû : ${formatFCFA(disponible)}. Paiement demandé : ${formatFCFA(montant)}.`;
  return null;
}

export function paiementEntierementAffecte(montant: number, affecte: number): boolean {
  return Number.isFinite(montant) && Number.isFinite(affecte) && montant > 0 && montant === affecte;
}