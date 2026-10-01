import type { FraisTransport } from "@/lib/cycle-vente";

/**
 * Normalise la saisie des frais de transport d'une commande.
 * « aucun » (ou type absent) => pas de frais; sinon montant entier >= 0.
 */
export function normaliserFraisTransport(
  type: string | null | undefined,
  montant: number | string | null | undefined,
): FraisTransport {
  if (!type || type === "aucun") return { type: null, montant: null };
  const m = Number(montant ?? 0);
  return { type: type as "livraison" | "expedition", montant: Number.isFinite(m) && m > 0 ? m : 0 };
}

/** Montant des frais à ajouter au total (0 quand aucun frais). */
export function montantFraisTransport(frais: FraisTransport): number {
  return frais.type ? Number(frais.montant ?? 0) : 0;
}

/** Total TTC + transport, les frais comptés une seule fois. */
export function totalAvecTransport(totalTtc: number, frais: FraisTransport): number {
  return totalTtc + montantFraisTransport(frais);
}
