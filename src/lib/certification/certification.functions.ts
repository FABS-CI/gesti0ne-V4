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

/**
 * Liste les certifications d'un document (sans jeton en clair).
 * Lot 2.3 : réservé aux utilisateurs pouvant lire le type de document, et
 * uniquement si le document existe et est visible avec leur propre session.
 */
const CERT_READ_RULES: Record<
  string,
  { perm: string; table: "factures" | "proformas" | "commandes" }
> = {
  FACTURE: { perm: "factures.voir", table: "factures" },
  PROFORMA: { perm: "proformas.voir", table: "proformas" },
  COMMANDE: { perm: "commandes.voir", table: "commandes" },
};

export const listCertificationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input?.reference ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.reference) return [];
    // Types que l'utilisateur peut lire ET dont le document existe pour lui (RLS).
    const allowedTypes: string[] = [];
    for (const [type, rule] of Object.entries(CERT_READ_RULES)) {
      const { data: ok } = await context.supabase.rpc("has_permission_v2", {
        _user_id: context.userId,
        _perm_code: rule.perm,
      });
      if (ok !== true) continue;
      const { count } = await context.supabase
        .from(rule.table)
        .select("reference", { count: "exact", head: true })
        .eq("reference", data.reference);
      if ((count ?? 0) > 0) allowedTypes.push(type);
    }
    if (allowedTypes.length === 0) throw new Error("Permission refusée : lecture du document");

    // La table n'est pas lisible directement (jetons protégés) : lecture serveur,
    // limitée aux types autorisés ci-dessus et aux colonnes sans jeton.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("document_certifications" as never)
      .select(
        "certification_id, document_type, document_reference, statut, version, certified_at, revoked_at, revocation_reason, canonical_hash",
      )
      .eq("document_reference", data.reference)
      .in("document_type", allowedTypes)
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
