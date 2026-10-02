/**
 * Source unique de la référence métier visible d'un carton :
 *   CL-AAAA-[N° NET DU BL]-CXXX   (ex. BL-2026-00040, carton 1 → CL-2026-40-C001)
 * Le colis_id (UUID) reste l'identifiant technique (QR, tracking, relations).
 */
export function buildColisReference(
  blReference: string | null | undefined,
  numeroCarton: number | null | undefined,
): string | null {
  if (!blReference || numeroCarton == null || !Number.isFinite(numeroCarton) || numeroCarton < 1) return null;
  const m = /^BL-(\d{4})-0*(\d+)$/i.exec(blReference.trim());
  if (!m) return null;
  const net = parseInt(m[2], 10);
  if (!Number.isFinite(net)) return null;
  return `CL-${m[1]}-${net}-C${String(Math.trunc(numeroCarton)).padStart(3, "0")}`;
}

/** Référence affichée : nouvelle nomenclature si calculable, sinon la référence stockée. */
export function displayColisReference(
  blReference: string | null | undefined,
  numeroCarton: number | null | undefined,
  stored?: string | null,
): string | undefined {
  return buildColisReference(blReference, numeroCarton) ?? (stored || undefined);
}
