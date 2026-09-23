import {
  ensureCertificationFn,
  ensureVerificationTokenFn,
} from "./certification.functions";

export type AutoCertification = {
  certified: boolean;
  certification_id: string | null;
  canonical_hash: string | null;
  version: number | null;
  certified_at: string | null;
  statut: string | null;
};

/** Un document est-il éligible à la certification automatique (FAC / PRO / BC / BL) ? */
export function isCertifiable(reference: string): boolean {
  const prefix = (reference ?? "").split("-")[0]?.toUpperCase() ?? "";
  return ["FAC", "FC", "PRO", "PF", "CMD", "BC", "BL"].includes(prefix);
}

/**
 * Certification automatique idempotente : appelée à la validation d'un document
 * et juste avant la génération de son PDF. Ne lève jamais d'erreur bloquante.
 */
export async function ensureCertificationSafe(
  reference: string,
): Promise<AutoCertification | null> {
  if (!reference || !isCertifiable(reference)) return null;
  try {
    const res = await ensureCertificationFn({ data: { reference } });
    return res as AutoCertification;
  } catch (e) {
    console.error("Certification automatique impossible", e);
    return null;
  }
}

/** Statut technique actif d'une certification (valeur backend historique : AUTHENTIC). */
export function isCertificationActive(statut?: string | null): boolean {
  return statut === "ACTIVE" || statut === "AUTHENTIC";
}

export type VerificationToken = AutoCertification & {
  token: string | null;
  verification_url: string | null;
};

/**
 * Jeton d'authenticité stable du document + URL publique.
 * Utilisé avant la génération du PDF : le même document produit toujours
 * le même jeton, donc le même lien et le même QR code.
 */
export async function ensureVerificationSafe(
  reference: string,
): Promise<VerificationToken | null> {
  if (!reference || !isCertifiable(reference)) return null;
  try {
    return (await ensureVerificationTokenFn({ data: { reference } })) as VerificationToken;
  } catch (e) {
    console.error("Jeton de vérification indisponible", e);
    return null;
  }
}
