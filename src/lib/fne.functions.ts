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
  source: "dgi_api";
};

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
        invoice?: { id?: string; reference?: string; token?: string; status?: string };
      };
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`Réponse DGI illisible: ${text.slice(0, 200)}`);
      }
      const reference = body.reference ?? body.invoice?.reference ?? "";
      const token = body.token ?? body.invoice?.token ?? "";
      if (!reference || !token) throw new Error("Réponse DGI incomplète (reference/token manquants)");

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
