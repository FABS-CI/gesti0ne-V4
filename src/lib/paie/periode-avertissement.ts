/** Avertissement (non bloquant) quand la période de paie commence après la date de paiement ou d'émission. */
export function avertissementPeriode(debut: string, datePaiement: string, aujourdhui: string): string | null {
  if (!debut) return null;
  if (datePaiement && debut > datePaiement) return "La période de paie est postérieure à la date de paiement.";
  if (aujourdhui && debut > aujourdhui) return "La période de paie est postérieure à la date d'émission du bulletin.";
  return null;
}
