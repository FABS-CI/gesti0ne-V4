/**
 * Service serveur de certification numérique des documents.
 * - Empreinte SHA-256 des données canoniques
 * - Signature Ed25519 avec la clé privée du serveur (secret DOC_SIGNING_PRIVATE_KEY)
 * - Jeton de vérification aléatoire de 256 bits, stocké en base uniquement sous forme de hash
 */
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from "crypto";
import { canonicalString, toCanonical, type CanonicalDocument } from "./canonical";

import { calculateInvoicePaymentStatus } from "@/lib/factures/payment-status";

export type DocType = "FACTURE" | "PROFORMA" | "COMMANDE" | "BL";

export type CertStatut = "AUTHENTIC" | "REVOKED" | "CANCELLED";

export type VerificationResult =
  | { status: "AUTHENTIC"; document: PublicDocument }
  | { status: "REVOKED" | "CANCELLED"; document: PublicDocument; reason?: string | null }
  | { status: "TAMPERED"; document: PublicDocument }
  | { status: "UNCERTIFIED"; document: PublicDocument }
  | { status: "INVALID" };

export type PublicDocument = {
  docType: string;
  reference: string;
  date: string | null;
  client_nom: string | null;
  representant_nom?: string | null;
  montant: number | null;
  statut_document?: string | null;
  certification_id?: string | null;
  certified_at?: string | null;
  canonical_hash?: string | null;
  signature_algorithm?: string | null;
  /** Factures uniquement : état de paiement recalculé à chaque lecture. */
  paiement?: {
    totalAPayer: number;
    montantPaye: number;
    resteAPayer: number;
    statut: string;
  } | null;
};

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newVerificationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url"); // 256 bits
  return { token, tokenHash: sha256Hex(token) };
}

function privateKeyObject() {
  const b64 = process.env["DOC_SIGNING_PRIVATE_KEY"];
  if (!b64) throw new Error("Clé de signature indisponible");
  return createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
}

function publicKeyObject(publicKeyB64?: string) {
  const b64 = publicKeyB64 ?? process.env["DOC_SIGNING_PUBLIC_KEY"];
  if (!b64) throw new Error("Clé publique indisponible");
  return createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
}

export function signPayload(payload: string): string {
  return sign(null, Buffer.from(payload, "utf8"), privateKeyObject()).toString("base64");
}

export function verifySignature(payload: string, signatureB64: string, publicKeyB64?: string): boolean {
  try {
    return verify(
      null,
      Buffer.from(payload, "utf8"),
      publicKeyObject(publicKeyB64),
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

/** Construit la représentation canonique + son empreinte pour un document. */
export function buildCanonical(input: Parameters<typeof toCanonical>[0]): {
  canonical: CanonicalDocument;
  payload: string;
  hash: string;
} {
  const canonical = toCanonical(input);
  const payload = canonicalString(canonical);
  return { canonical, payload, hash: sha256Hex(payload) };
}

/** Récupère les données source d'un document depuis la base (service role). */
export async function loadDocumentData(
  reference: string,
): Promise<{ type: DocType; id: string; data: PublicDocument; canonicalInput: Parameters<typeof toCanonical>[0] } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tables: Array<{
    table: string;
    idCol: string;
    type: DocType;
    label: string;
    dateCol: string;
    montantCol: string;
  }> = [
    { table: "factures", idCol: "facture_id", type: "FACTURE", label: "Facture", dateCol: "date_facture", montantCol: "montant_total" },
    { table: "proformas", idCol: "proforma_id", type: "PROFORMA", label: "Proforma", dateCol: "date_proforma", montantCol: "montant_ttc" },
    { table: "commandes", idCol: "commande_id", type: "COMMANDE", label: "Bon de commande", dateCol: "date_commande", montantCol: "montant_total" },
    { table: "bons_livraison", idCol: "bl_id", type: "BL", label: "Bon de livraison", dateCol: "date_bon", montantCol: "montant" },
  ];

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);

  for (const t of tables) {
    let query = supabaseAdmin.from(t.table as any).select("*");
    query = isUuid
      ? (query as any).or(`${t.idCol}.eq.${reference},reference.ilike.${reference}`)
      : (query as any).ilike("reference", reference);

    const { data } = await (query as any).maybeSingle();
    if (!data) continue;

    const row = data as Record<string, any>;
    const docId = row[t.idCol] as string;

    // Lignes : les factures et BL s'appuient sur les lignes de commande
    let lignes: Array<Record<string, unknown>> = [];
    if (t.type === "FACTURE") {
      const { data: l } = await supabaseAdmin
        .from("commande_lignes" as any)
        .select("designation, quantite, prix_unitaire, total_ligne, total_ht_ligne")
        .eq("facture_id", docId);
      lignes = (l as any) ?? [];
    } else if (t.type === "COMMANDE") {
      const { data: l } = await supabaseAdmin
        .from("commande_lignes")
        .select("designation, quantite, prix_unitaire, total_ligne, total_ht_ligne")
        .eq("commande_id", docId);
      lignes = (l as any) ?? [];
    } else if (t.type === "PROFORMA") {
      const { data: l } = await supabaseAdmin
        .from("proforma_lignes")
        .select("designation, quantite, prix_unitaire, total_ligne")
        .eq("proforma_id", docId);
      lignes = (l as any) ?? [];
    }

    const montant = Number(row[t.montantCol] ?? row.montant_total ?? row.montant_ttc ?? row.montant ?? 0);

    // Statut de paiement (factures) : source unique de vérité, jamais mis en cache.
    let paiement = null as Awaited<ReturnType<typeof calculateInvoicePaymentStatus>>;
    if (t.type === "FACTURE") {
      paiement = await calculateInvoicePaymentStatus(docId, supabaseAdmin as never);
    }

    return {
      type: t.type,
      id: docId,
      data: {
        docType: t.label,
        reference: row.reference,
        date: row[t.dateCol] ?? null,
        client_nom: row.client_nom ?? null,
        representant_nom: row.representant_nom ?? null,
        montant,
        statut_document: row.statut ?? null,
        paiement,
      },
      canonicalInput: {
        type: t.type,
        reference: row.reference,
        date: row[t.dateCol],
        client_nom: row.client_nom,
        montant_total: montant,
        lignes,
      },
    };
  }

  return null;
}

/** Certifie un document : empreinte, signature, jeton. Renvoie le jeton en clair une seule fois. */
export async function certifyDocument(
  reference: string,
  userId: string | null,
): Promise<{ token: string; certification_id: string; hash: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const doc = await loadDocumentData(reference);
  if (!doc) throw new Error("Document introuvable");

  const { payload, hash, canonical } = buildCanonical(doc.canonicalInput);
  const signature = signPayload(payload);

  const { data: key } = await supabaseAdmin
    .from("signature_keys" as any)
    .select("key_id")
    .eq("is_active", true)
    .maybeSingle();

  // Version suivante si le document a déjà été certifié
  const { data: prev } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("version, verification_token, token_hash")
    .eq("document_type", doc.type)
    .eq("document_id", doc.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((prev as any)?.version ?? 0) + 1;

  // STABILITÉ : un document conserve toujours le même jeton public, même
  // lorsqu'une nouvelle version de certification est créée.
  const previousToken = (prev as any)?.verification_token as string | undefined;
  const fresh = newVerificationToken();
  const token = previousToken ?? fresh.token;
  const tokenHash = previousToken ? sha256Hex(previousToken) : fresh.tokenHash;

  const { data: inserted, error } = await supabaseAdmin
    .from("document_certifications" as any)
    .insert({
      document_type: doc.type,
      document_id: doc.id,
      document_reference: doc.data.reference,
      canonical_hash: hash,
      signature,
      key_id: (key as any)?.key_id ?? null,
      token_hash: tokenHash,
      verification_token: token,
      verification_url: buildVerificationUrl(token),
      statut: "AUTHENTIC",
      snapshot: canonical as any,
      certified_by: userId,
      version,
    })
    .select("certification_id")
    .single();

  if (error) throw new Error(error.message);

  return { token, certification_id: (inserted as any).certification_id, hash };
}

/** Base publique des liens de vérification (jamais un domaine éphémère de preview). */
export const PUBLIC_BASE_URL = "https://gesti0ne.lovable.app";

export function buildVerificationUrl(token: string): string {
  return `${PUBLIC_BASE_URL}/verify/${token}`;
}

export async function revokeCertification(
  certificationId: string,
  userId: string | null,
  reason: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("document_certifications" as any)
    .update({
      statut: "REVOKED",
      revoked_at: new Date().toISOString(),
      revoked_by: userId,
      revocation_reason: reason,
    })
    .eq("certification_id", certificationId);
  if (error) throw new Error(error.message);
}

/** Vérification publique : jeton -> certification -> hash -> signature -> statut. */
export async function verifyByToken(token: string): Promise<VerificationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = sha256Hex(token);

  // Le jeton est stable : on retient toujours la certification la plus récente.
  const { data: rows } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("*, signature_keys(public_key, algorithm)")
    .eq("token_hash", tokenHash)
    .order("version", { ascending: false })
    .limit(1);

  const cert = (rows as any[] | null)?.[0];
  if (!cert) return { status: "INVALID" };
  return evaluateCertification(cert);
}

/**
 * Vérification par référence de document (QR imprimés historiques).
 * Renvoie UNCERTIFIED si le document existe mais n'a jamais été certifié.
 */
export async function verifyByReference(reference: string): Promise<VerificationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const doc = await loadDocumentData(reference);
  if (!doc) return { status: "INVALID" };

  const { data: cert } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("*, signature_keys(public_key, algorithm)")
    .eq("document_type", doc.type)
    .eq("document_id", doc.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cert) return { status: "UNCERTIFIED", document: doc.data };
  return evaluateCertification(cert);
}

async function evaluateCertification(cert: unknown): Promise<VerificationResult> {
  const c = cert as any;

  const doc = await loadDocumentData(c.document_reference);
  if (!doc) return { status: "INVALID" };

  const publicDoc: PublicDocument = {
    ...doc.data,
    certification_id: c.certification_id ?? null,
    certified_at: c.certified_at,
    canonical_hash: c.canonical_hash,
    signature_algorithm: c.signature_keys?.algorithm ?? "Ed25519",
  };

  const { payload, hash } = buildCanonical(doc.canonicalInput);
  const signatureOk = verifySignature(
    canonicalStringFromSnapshot(c.snapshot) ?? payload,
    c.signature,
    c.signature_keys?.public_key,
  );

  if (!signatureOk) return { status: "TAMPERED", document: publicDoc };
  if (hash !== c.canonical_hash) return { status: "TAMPERED", document: publicDoc };

  if (c.statut === "REVOKED" || c.statut === "CANCELLED") {
    return { status: c.statut, document: publicDoc, reason: c.revocation_reason };
  }

  return { status: "AUTHENTIC", document: publicDoc };
}

function canonicalStringFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  try {
    return canonicalString(snapshot as CanonicalDocument);
  } catch {
    return null;
  }
}

/** Journalise une vérification publique (sans donnée personnelle en clair). */
export async function logVerification(params: {
  certificationId?: string | null;
  reference?: string | null;
  result: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("document_verification_logs" as any).insert({
      certification_id: params.certificationId ?? null,
      document_reference: params.reference ?? null,
      result: params.result,
      ip_hash: params.ip ? sha256Hex(params.ip) : null,
      user_agent: params.userAgent?.slice(0, 200) ?? null,
    });
  } catch {
    // la journalisation ne doit jamais bloquer une vérification
  }
}

/** Limitation de débit simple : 30 vérifications / 10 min par adresse. */
export async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("document_verification_logs" as any)
      .select("log_id", { count: "exact", head: true })
      .eq("ip_hash", sha256Hex(ip))
      .gte("created_at", since);
    return (count ?? 0) > 30;
  } catch {
    return false;
  }
}

/** Types de documents soumis à la certification automatique. */
export const AUTO_CERTIFIED_TYPES: DocType[] = ["FACTURE", "PROFORMA", "COMMANDE", "BL"];

export type EnsureCertificationResult = {
  certified: boolean;
  certification_id: string | null;
  canonical_hash: string | null;
  version: number | null;
  certified_at: string | null;
  statut: string | null;
};

/**
 * Certification automatique et idempotente d'un document (FACTURE, PROFORMA, COMMANDE).
 * - Si une certification existe déjà avec la même empreinte : elle est réutilisée.
 * - Si le document a changé : une nouvelle version est créée automatiquement.
 * - Les autres types de documents ne sont jamais certifiés.
 */
export async function ensureCertification(
  reference: string,
  userId: string | null = null,
): Promise<EnsureCertificationResult> {
  const empty: EnsureCertificationResult = {
    certified: false,
    certification_id: null,
    canonical_hash: null,
    version: null,
    certified_at: null,
    statut: null,
  };

  const doc = await loadDocumentData(reference);
  if (!doc) return empty;
  if (!AUTO_CERTIFIED_TYPES.includes(doc.type)) return empty;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hash } = buildCanonical(doc.canonicalInput);

  const { data: last } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("certification_id, canonical_hash, version, certified_at, statut")
    .eq("document_type", doc.type)
    .eq("document_id", doc.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = last as any;
  if (prev && prev.canonical_hash === hash) {
    return {
      certified: prev.statut === "AUTHENTIC",
      certification_id: prev.certification_id,
      canonical_hash: prev.canonical_hash,
      version: prev.version,
      certified_at: prev.certified_at,
      statut: prev.statut,
    };
  }

  // Document jamais certifié ou modifié depuis : nouvelle version automatique.
  const created = await certifyDocument(reference, userId);

  const { data: fresh } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("certification_id, canonical_hash, version, certified_at, statut")
    .eq("certification_id", created.certification_id)
    .maybeSingle();

  const f = fresh as any;
  return {
    certified: true,
    certification_id: created.certification_id,
    canonical_hash: created.hash,
    version: f?.version ?? null,
    certified_at: f?.certified_at ?? new Date().toISOString(),
    statut: f?.statut ?? "AUTHENTIC",
  };
}

export type VerificationTokenResult = EnsureCertificationResult & {
  token: string | null;
  verification_url: string | null;
};

/**
 * Jeton d'authenticité stable d'un document (FACTURE, PROFORMA, COMMANDE, BL).
 * - Certifie le document si nécessaire (idempotent).
 * - Réutilise TOUJOURS le jeton existant : le QR code d'un document ne change jamais.
 */
export async function ensureVerificationToken(
  reference: string,
  userId: string | null = null,
): Promise<VerificationTokenResult> {
  const cert = await ensureCertification(reference, userId);
  if (!cert.certification_id) return { ...cert, token: null, verification_url: null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("document_certifications" as any)
    .select("verification_token, verification_url")
    .eq("certification_id", cert.certification_id)
    .maybeSingle();

  let token = (data as any)?.verification_token as string | null | undefined;

  // Certifications historiques créées avant l'ajout du jeton en clair : on en crée un, une seule fois.
  if (!token) {
    const generated = newVerificationToken();
    const { error } = await supabaseAdmin
      .from("document_certifications" as any)
      .update({
        verification_token: generated.token,
        token_hash: generated.tokenHash,
        verification_url: buildVerificationUrl(generated.token),
      })
      .eq("certification_id", cert.certification_id);
    if (error) return { ...cert, token: null, verification_url: null };
    token = generated.token;
  }

  return { ...cert, token, verification_url: buildVerificationUrl(token) };
}
