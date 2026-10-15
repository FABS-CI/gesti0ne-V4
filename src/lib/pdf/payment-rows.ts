/**
 * Lignes MONTANT PAYÉ / RESTE À PAYER du récap : uniquement sur une Facture
 * ayant réellement reçu un paiement (> 0,005 FCFA). Jamais sur les autres types.
 */
export function buildPaymentRows(
  docType: string,
  paiement: { montantPaye?: number } | null | undefined,
  totalAPayer: number,
): Array<{ label: string; value: number }> {
  if (docType !== "Facture" || !paiement) return [];
  const paye = Math.max(0, Number(paiement.montantPaye) || 0);
  if (paye <= 0.005) return [];
  return [
    { label: "MONTANT PAYÉ", value: paye },
    { label: "RESTE À PAYER", value: Math.max(0, totalAPayer - paye) },
  ];
}
