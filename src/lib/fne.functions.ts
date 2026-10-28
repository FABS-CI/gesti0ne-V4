import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DgiSignRefused,
  assertFneRowSignable,
  assertRateLimit,
  buildPayloadFromFacture,
  buildPayloadFromManualRow,
  type ClientForSign,
  type DgiPayload,
  type FactureForSign,
  type FneRowForSign,
} from "@/lib/fne/dgi-sign-rules";
import {
  assertFneRowRefundable,
  buildRefundLines,
  dgiRefundTarget,
  refundTotal,
  refundedQuantities,
  type FneRowForRefund,
  type RefundLine,
} from "@/lib/fne/dgi-refund-rules";

/**
 * Branchement production DGI.
 *
 * Sécurité (Lot 2.2) :
 *  - réservé aux utilisateurs ayant `fne.soumettre` (même code que le contrôle navigateur) ;
 *  - le navigateur n'envoie que l'identifiant de la demande FNE ; le serveur relit
 *    la facture, le client et le total en base et construit lui-même la requête DGI ;
 *  - refus si facture annulée, déjà signée ou montant différent du total enregistré ;
 *  - un seul appel DGI par facture (verrou `fne_sign_locks`) ;
 *  - au plus N appels par utilisateur et par minute ;
 *  - chaque appel est journalisé dans `fne_logs` (jamais la clé API).
 */
const SignInputSchema = z.object({ fne_id: z.string().uuid() });

export type DGISignResponse = {
  ncc: string;
  reference: string;
  token: string;
  warning: boolean;
  balance_sticker: number;
  invoice: { id: string; reference: string; token: string; status: string };
  /** Identifiants DGI des lignes : requis plus tard pour émettre un avoir. */
  items: { id: string }[];
  source: "dgi_api";
};

/** Identifiants des lignes renvoyés par la DGI (format `items` ou `invoice.items`). */
function dgiItemIds(body: { items?: unknown; invoice?: { items?: unknown } }): { id: string }[] {
  const raw = Array.isArray(body.items) ? body.items : body.invoice?.items;
  return (Array.isArray(raw) ? (raw as { id?: unknown }[]) : [])
    .filter((it) => typeof it?.id === "string")
    .map((it) => ({ id: it.id as string }));
}

export const signInvoiceWithDGI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SignInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<DGISignResponse> => {
    const userId = context.userId;

    // 1. Permission (vérifiée avec la session de l'utilisateur, pas la clé admin).
    const { data: allowed, error: permErr } = await context.supabase.rpc("has_permission_v2", {
      _user_id: userId,
      _perm_code: "fne.soumettre",
    });
    if (permErr || allowed !== true) {
      throw new DgiSignRefused("permission", "Permission refusée : fne.soumettre");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t0 = Date.now();
    const log = async (statut: "succes" | "echec" | "refus", extra: Record<string, unknown>) => {
      await supabaseAdmin.from("fne_logs").insert({
        fne_facture_id: data.fne_id,
        facture_id: (extra.facture_id as string | null) ?? null,
        action: "dgi_sign_call",
        statut,
        attempt_number: 1,
        duration_ms: Date.now() - t0,
        payload: { user_id: userId, fne_id: data.fne_id } as never,
        response: extra as never,
      });
    };

    // 2. Limite de débit par utilisateur.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("fne_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "dgi_sign_call")
      .gte("created_at", since)
      .filter("payload->>user_id", "eq", userId);
    try {
      assertRateLimit(count ?? 0);
    } catch (e) {
      await log("refus", { reason: "rate_limit" });
      throw e;
    }

    // 3. Relecture de la demande et de la facture en base.
    const { data: rowRaw } = await supabaseAdmin
      .from("fne_factures")
      .select(
        "fne_id, facture_id, reference, statut, code_dgi, montant, template, payment_method, invoice_type, client_nom, client_ncc, client_telephone, client_email, client_seller_name, commercial_message, footer, items, discount",
      )
      .eq("fne_id", data.fne_id)
      .maybeSingle();
    const row = (rowRaw ?? null) as FneRowForSign | null;

    let payload: DgiPayload;
    let docKey: string;
    try {
      let alreadySigned = false;
      if (row?.facture_id) {
        const { count: signedCount } = await supabaseAdmin
          .from("fne_factures")
          .select("fne_id", { count: "exact", head: true })
          .eq("facture_id", row.facture_id)
          .eq("statut", "accepted")
          .neq("fne_id", row.fne_id);
        alreadySigned = (signedCount ?? 0) > 0;
      }
      assertFneRowSignable(row, alreadySigned);
      if (row!.facture_id) {
        const { data: f } = await supabaseAdmin
          .from("factures")
          .select("facture_id, reference, statut, montant_total, client_nom, client_id")
          .eq("facture_id", row!.facture_id)
          .maybeSingle();
        let client: ClientForSign = null;
        if (f?.client_id) {
          const { data: c } = await supabaseAdmin
            .from("clients")
            .select("nom, telephone, email, nif")
            .eq("client_id", f.client_id)
            .maybeSingle();
          client = (c ?? null) as ClientForSign;
        }
        payload = buildPayloadFromFacture(row!, (f ?? null) as FactureForSign | null, client);
        docKey = `facture:${row!.facture_id}`;
      } else {
        payload = buildPayloadFromManualRow(row!);
        docKey = `fne:${row!.fne_id}`;
      }
    } catch (e) {
      await log("refus", {
        facture_id: row?.facture_id ?? null,
        reason: e instanceof DgiSignRefused ? e.code : "erreur",
      });
      throw e;
    }

    // 4. Verrou d'idempotence : un seul appel DGI par document.
    const { error: lockErr } = await supabaseAdmin.from("fne_sign_locks").insert({
      doc_key: docKey,
      facture_id: row!.facture_id,
      fne_id: row!.fne_id,
      user_id: userId,
    });
    if (lockErr) {
      await log("refus", { facture_id: row!.facture_id, reason: "en_cours_ou_signee" });
      throw new DgiSignRefused(
        "en_cours",
        "Une signature DGI est déjà en cours ou terminée pour ce document.",
      );
    }
    const releaseLock = () => supabaseAdmin.from("fne_sign_locks").delete().eq("doc_key", docKey);

    const apiKey = process.env.DGI_API_KEY;
    const apiUrl = process.env.DGI_API_URL_PROD ?? "https://api.dgi.gouv.ci/ws";
    const companyNcc = process.env.DGI_COMPANY_NCC ?? "";
    if (!apiKey) {
      await releaseLock();
      await log("echec", { facture_id: row!.facture_id, reason: "cle_absente" });
      throw new Error(
        "DGI_API_KEY manquante côté serveur. Ajoutez le secret avant d'activer le mode production.",
      );
    }

    try {
      const resp = await fetch(`${apiUrl}/external/invoices/sign`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`DGI ${resp.status}: ${text.slice(0, 400)}`);
      let body: {
        reference?: string;
        token?: string;
        warning?: boolean;
        balance_sticker?: number;
        items?: unknown;
        invoice?: {
          id?: string;
          reference?: string;
          token?: string;
          status?: string;
          items?: unknown;
        };
      };
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`Réponse DGI illisible: ${text.slice(0, 200)}`);
      }
      const reference = body.reference ?? body.invoice?.reference ?? "";
      const token = body.token ?? body.invoice?.token ?? "";
      if (!reference || !token)
        throw new Error("Réponse DGI incomplète (reference/token manquants)");

      await log("succes", { facture_id: row!.facture_id, http_status: resp.status, reference });
      return {
        ncc: companyNcc,
        reference,
        token,
        warning: Boolean(body.warning),
        balance_sticker: body.balance_sticker ?? 0,
        invoice: {
          id: body.invoice?.id ?? reference,
          reference,
          token,
          status: body.invoice?.status ?? "certified",
        },
        items: dgiItemIds(body),
        source: "dgi_api",
      };
    } catch (e) {
      // Échec réseau ou DGI : on libère le verrou pour permettre un nouvel essai.
      await releaseLock();
      await log("echec", {
        facture_id: row!.facture_id,
        error: e instanceof Error ? e.message.slice(0, 300) : "erreur",
      });
      throw e;
    }
  });

/**
 * Avoir sur une facture certifiée.
 *
 * Sécurité :
 *  - réservé à `fne.rembourser` ;
 *  - le navigateur n'envoie que l'identifiant de la facture certifiée et, au besoin,
 *    les quantités par ligne ; le serveur relit les lignes et prix certifiés et calcule le montant ;
 *  - jamais plus que ce qui reste à rembourser (avoirs certifiés déjà émis déduits) ;
 *  - une seule demande d'avoir à la fois par facture (verrou `fne_sign_locks`) ;
 *  - facture certifiée en production : l'avoir est obligatoirement certifié par la DGI,
 *    il n'est jamais marqué « certifié » sans réponse de la DGI.
 */
const RefundInputSchema = z.object({
  fne_id: z.string().uuid(),
  lignes: z
    .array(z.object({ index: z.number().int().min(0), quantity: z.number().positive() }))
    .optional(),
});

export const refundInvoiceWithDGI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RefundInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: allowed, error: permErr } = await context.supabase.rpc("has_permission_v2", {
      _user_id: userId,
      _perm_code: "fne.rembourser",
    });
    if (permErr || allowed !== true) {
      throw new DgiSignRefused("permission", "Permission refusée : fne.rembourser");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t0 = Date.now();
    const log = async (statut: "succes" | "echec" | "refus", extra: Record<string, unknown>) => {
      await supabaseAdmin.from("fne_logs").insert({
        fne_facture_id: data.fne_id,
        facture_id: (extra.facture_id as string | null) ?? null,
        action: "dgi_refund_call",
        statut,
        attempt_number: 1,
        duration_ms: Date.now() - t0,
        payload: { user_id: userId, fne_id: data.fne_id, lignes: data.lignes ?? null } as never,
        response: extra as never,
      });
    };

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("fne_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "dgi_refund_call")
      .gte("created_at", since)
      .filter("payload->>user_id", "eq", userId);
    try {
      assertRateLimit(count ?? 0);
    } catch (e) {
      await log("refus", { reason: "rate_limit" });
      throw e;
    }

    const { data: originalRaw } = await supabaseAdmin
      .from("fne_factures")
      .select("*")
      .eq("fne_id", data.fne_id)
      .maybeSingle();
    const original = (originalRaw ?? null) as (FneRowForRefund & {
      client_nom: string | null;
      client_ncc: string | null;
      template: string | null;
      payment_method: string | null;
    }) | null;

    const docKey = `avoir:${data.fne_id}`;
    try {
      assertFneRowRefundable(original);
      // Verrou avant de compter les avoirs existants : deux demandes simultanées
      // ne peuvent pas rembourser deux fois le même reste.
      const { error: lockErr } = await supabaseAdmin.from("fne_sign_locks").insert({
        doc_key: docKey,
        facture_id: original.facture_id,
        fne_id: data.fne_id,
        user_id: userId,
      });
      if (lockErr) {
        throw new DgiSignRefused("en_cours", "Un avoir est déjà en cours pour cette facture.");
      }
    } catch (e) {
      await log("refus", {
        facture_id: original?.facture_id ?? null,
        reason: e instanceof DgiSignRefused ? e.code : "erreur",
      });
      throw e;
    }
    const releaseLock = () => supabaseAdmin.from("fne_sign_locks").delete().eq("doc_key", docKey);

    let lines: RefundLine[];
    try {
      const { data: avoirs } = await supabaseAdmin
        .from("fne_factures")
        .select("items")
        .eq("parent_fne_id", data.fne_id)
        .eq("statut", "accepted");
      lines = buildRefundLines(original, refundedQuantities(avoirs ?? []), data.lignes);
    } catch (e) {
      await releaseLock();
      await log("refus", {
        facture_id: original.facture_id,
        reason: e instanceof DgiSignRefused ? e.code : "erreur",
      });
      throw e;
    }

    const montant = refundTotal(lines);
    const production = original.source === "dgi_api";
    let reference: string;
    let token: string;
    let responsePayload: unknown;

    try {
      if (production) {
        const target = dgiRefundTarget(original.response_payload);
        if (!target) {
          throw new DgiSignRefused(
            "introuvable",
            "Identifiants DGI des lignes absents pour cette facture (certifiée avant leur conservation) : émettez l'avoir depuis le portail FNE de la DGI.",
          );
        }
        const apiKey = process.env.DGI_API_KEY;
        const apiUrl = process.env.DGI_API_URL_PROD ?? "https://api.dgi.gouv.ci/ws";
        if (!apiKey) throw new Error("DGI_API_KEY manquante côté serveur.");
        const resp = await fetch(`${apiUrl}/external/invoices/${target.invoiceId}/refund`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            items: lines.map((l) => ({ id: target.itemIds[l.index], quantity: l.quantity })),
          }),
        });
        const text = await resp.text();
        if (!resp.ok) throw new Error(`DGI ${resp.status}: ${text.slice(0, 400)}`);
        let body: {
          reference?: string;
          token?: string;
          invoice?: { reference?: string; token?: string };
        };
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error(`Réponse DGI illisible: ${text.slice(0, 200)}`);
        }
        reference = body.reference ?? body.invoice?.reference ?? "";
        token = body.token ?? body.invoice?.token ?? "";
        if (!reference || !token) {
          throw new Error("Réponse DGI incomplète (reference/token manquants)");
        }
        responsePayload = body;
      } else {
        // Facture certifiée en bac à sable : avoir de test, signalé comme tel.
        reference = `SANDBOX-AVR-${Date.now().toString(36).toUpperCase()}`;
        token = crypto.randomUUID().replace(/-/g, "");
        responsePayload = { source: "sandbox" };
      }
    } catch (e) {
      await releaseLock();
      await log(e instanceof DgiSignRefused ? "refus" : "echec", {
        facture_id: original.facture_id,
        error: e instanceof Error ? e.message.slice(0, 300) : "erreur",
      });
      throw e;
    }

    const QRCode = await import("qrcode");
    const qr = await QRCode.toDataURL(token, { margin: 1, width: 220 }).catch(() => null);
    const now = new Date().toISOString();
    const { data: avoir, error: insErr } = await supabaseAdmin
      .from("fne_factures")
      .insert({
        reference: `AVR-${original.reference}-${Date.now().toString(36).toUpperCase()}`,
        facture_id: original.facture_id,
        parent_fne_id: data.fne_id,
        invoice_type: "refund",
        client_nom: original.client_nom,
        client_ncc: original.client_ncc,
        template: original.template,
        payment_method: original.payment_method,
        items: lines as never,
        montant: -montant,
        date_emission: now.slice(0, 10),
        statut: "accepted",
        code_dgi: reference,
        token,
        qr_code: qr,
        response_payload: responsePayload as never,
        source: production ? "dgi_api" : "sandbox",
        submitted_at: now,
        validated_at: now,
        notes: `Avoir de la facture ${original.reference}`,
      })
      .select()
      .single();
    await releaseLock();
    if (insErr) {
      // L'avoir est certifié côté DGI mais pas enregistré ici : on garde la trace complète.
      await log("echec", {
        facture_id: original.facture_id,
        reason: "enregistrement",
        reference,
        token,
        error: insErr.message,
      });
      throw new Error(
        `Avoir certifié par la DGI (${reference}) mais non enregistré : ${insErr.message}. Contactez l'administrateur avec cette référence.`,
      );
    }
    await log("succes", { facture_id: original.facture_id, reference, montant: -montant });
    return avoir;
  });
