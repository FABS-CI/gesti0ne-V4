/**
 * Source unique de vérité du statut de paiement d'une facture.
 *
 * Le statut n'est JAMAIS saisi ni stocké : il est recalculé à partir des
 * paiements réellement affectés à la facture (table `payment_allocations`,
 * paiements de statut `valide` uniquement). Tous les affichages (écran, liste,
 * PDF, aperçu, impression, page publique de scan QR) doivent passer par ici.
 */

export type InvoicePaymentStatut = "NON PAYÉE" | "PARTIELLEMENT PAYÉE" | "PAYÉE";

export type InvoicePaymentStatus = {
  totalAPayer: number;
  montantPaye: number;
  resteAPayer: number;
  statut: InvoicePaymentStatut;
};

/** Couleur unique des 3 statuts de paiement (FABS-CI). */
export const PAYMENT_STATUS_COLOR = "#F59E0B";

/** Tolérance d'arrondi monétaire (le FCFA n'a pas de décimales, marge de sécurité). */
const EPS = 0.005;

const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

/** Calcul pur : total + montant réellement affecté → statut, reste jamais négatif. */
export function computeInvoicePaymentStatus(
  totalAPayer: unknown,
  montantPaye: unknown,
): InvoicePaymentStatus {
  const total = Math.max(0, round2(totalAPayer));
  const paye = Math.max(0, round2(montantPaye));
  const reste = Math.max(0, round2(total - paye));
  const statut: InvoicePaymentStatut =
    paye <= EPS ? "NON PAYÉE" : reste <= EPS ? "PAYÉE" : "PARTIELLEMENT PAYÉE";
  return { totalAPayer: total, montantPaye: paye, resteAPayer: reste, statut };
}

/** Client Supabase minimal (navigateur authentifié ou client serveur privilégié). */
type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Fonction centrale unique : état de paiement d'une facture donnée.
 * Ne compte que les allocations rattachées à cette facture précise.
 */
export async function calculateInvoicePaymentStatus(
  invoiceId: string,
  client: SupabaseLike,
): Promise<InvoicePaymentStatus | null> {
  if (!invoiceId) return null;

  const { data: facture, error } = await client
    .from("factures")
    .select("montant_total")
    .eq("facture_id", invoiceId)
    .maybeSingle();
  if (error) throw error;
  if (!facture) return null;

  const { data: rows, error: allocError } = await client
    .from("payment_allocations")
    .select("montant, paiements!inner(statut)")
    .eq("facture_id", invoiceId);
  if (allocError) throw allocError;

  const montantPaye = ((rows ?? []) as any[])
    .filter((r) => (r?.paiements?.statut ?? "") === "valide")
    .reduce((sum, r) => sum + (Number(r?.montant) || 0), 0);

  return computeInvoicePaymentStatus((facture as any).montant_total, montantPaye);
}
