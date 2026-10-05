import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Certifie un document (facture, proforma, commande, BL) : hash + signature + jeton. */
export const certifyDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (!input?.reference || typeof input.reference !== "string") {
      throw new Error("Référence de document requise");
    }
    return { reference: input.reference.trim() };
  })
  .handler(async ({ data, context }) => {
    const { certifyDocument } = await import("./certification.server");
    const { token, certification_id, hash } = await certifyDocument(
      data.reference,
      context.userId ?? null,
    );
    return { token, certification_id, hash };
  });

/** Révoque une certification existante (motif obligatoire). */
export const revokeCertificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { certificationId: string; reason: string }) => {
    if (!input?.certificationId) throw new Error("Certification requise");
    if (!input?.reason?.trim()) throw new Error("Motif de révocation requis");
    return { certificationId: input.certificationId, reason: input.reason.trim() };
  })
  .handler(async ({ data, context }) => {
    const { revokeCertification } = await import("./certification.server");
    await revokeCertification(data.certificationId, context.userId ?? null, data.reason);
    return { ok: true };
  });

/** Liste les certifications d'un document (lecture authentifiée, sans jeton en clair). */
export const listCertificationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({ reference: String(input?.reference ?? "") }))
  .handler(async ({ data }) => {
    // Lecture serveur : la table n'est plus lisible directement (jetons protégés).
    // Seules les colonnes sans jeton sont renvoyées à l'utilisateur connecté.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("document_certifications" as never)
      .select(
        "certification_id, document_type, document_reference, statut, version, certified_at, revoked_at, revocation_reason, canonical_hash",
      )
      .eq("document_reference", data.reference)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as Array<Record<string, string | number | null>>;
    return list.map((r) => ({
      certification_id: String(r["certification_id"] ?? ""),
      document_type: String(r["document_type"] ?? ""),
      document_reference: String(r["document_reference"] ?? ""),
      statut: String(r["statut"] ?? ""),
      version: Number(r["version"] ?? 0),
      certified_at: r["certified_at"] ? String(r["certified_at"]) : null,
      revoked_at: r["revoked_at"] ? String(r["revoked_at"]) : null,
      revocation_reason: r["revocation_reason"] ? String(r["revocation_reason"]) : null,
      canonical_hash: String(r["canonical_hash"] ?? ""),
    }));
  });

/**
 * Certification automatique idempotente d'une FACTURE, PROFORMA ou COMMANDE.
 * Appelée automatiquement à la validation du document et avant la génération du PDF.
 */
export const ensureCertificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input?.reference ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.reference) {
      return {
        certified: false,
        certification_id: null,
        canonical_hash: null,
        version: null,
        certified_at: null,
        statut: null,
      };
    }
    const { ensureCertification } = await import("./certification.server");
    return ensureCertification(data.reference, context.userId ?? null);
  });

/**
 * Jeton d'authenticité stable d'un document + URL publique de vérification.
 * Appelé avant chaque génération de PDF : le jeton existant est toujours réutilisé.
 */
export const ensureVerificationTokenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input?.reference ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.reference) {
      return {
        certified: false,
        certification_id: null,
        canonical_hash: null,
        version: null,
        certified_at: null,
        statut: null,
        token: null,
        verification_url: null,
      };
    }
    const { ensureVerificationToken } = await import("./certification.server");
    return ensureVerificationToken(data.reference, context.userId ?? null);
  });
