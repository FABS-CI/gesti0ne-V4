import { supabase } from "@/integrations/supabase/client";
import { applyCorrections, type FNEInvoicePayload } from "./types";
import { loadFNESettings, isProductionReady, type FNESettings } from "./settings";
import { getFNEInvoice } from "./reads";

async function submitToDGI(fneId: string, settings: FNESettings) {
  if (isProductionReady(settings)) {
    // Le serveur relit la demande et la facture en base : seul l'identifiant est transmis.
    const { signInvoiceWithDGI } = await import("@/lib/fne.functions");
    return signInvoiceWithDGI({ data: { fne_id: fneId } });
  }
  await new Promise((r) => setTimeout(r, 350));
  const fneRef = `DGI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const token = crypto.randomUUID().replace(/-/g, "");
  return {
    ncc: settings.company_ncc || "SANDBOX",
    reference: fneRef,
    token,
    warning: false,
    balance_sticker: 500,
    invoice: { id: fneRef, reference: fneRef, token, status: "certified" },
    source: "sandbox" as const,
  };
}

async function generateQR(content: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(content, { margin: 1, width: 220 });
}

export async function submitFNEInvoice(payload: FNEInvoicePayload) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("fne.soumettre");
  const settings = await loadFNESettings();
  const corrections = applyCorrections(payload, settings.company_ncc ?? "");
  const montantTotal =
    payload.items.reduce(
      (s, it) => s + it.quantity * it.amount * (1 - (it.discount ?? 0) / 100),
      0,
    ) - (payload.discount ?? 0);

  const reference =
    payload.reference ||
    `FNE-${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}`;
  const { data: row, error: e1 } = await supabase
    .from("fne_factures")
    .insert({
      reference,
      facture_id: payload.facture_id ?? null,
      client_nom: payload.clientCompanyName,
      client_ncc: payload.clientNcc ?? null,
      client_telephone: payload.clientPhone ?? null,
      client_email: payload.clientEmail ?? null,
      client_seller_name: payload.clientSellerName ?? null,
      template: payload.template ?? "B2C",
      payment_method: payload.paymentMethod ?? "cash",
      invoice_type: payload.invoiceType ?? "sale",
      commercial_message: payload.commercialMessage ?? null,
      footer: payload.footer ?? null,
      items: payload.items as never,
      discount: payload.discount ?? 0,
      montant: montantTotal,
      date_emission: new Date().toISOString().slice(0, 10),
      statut: "pending",
      point_of_sale: settings.point_of_sale ?? "01",
      establishment: settings.establishment ?? "Siège Social",
      source: isProductionReady(settings) ? "dgi_api" : "sandbox",
      notes: corrections.length ? `Corrections: ${corrections.join(" | ")}` : null,
    })
    .select()
    .single();
  if (e1) throw e1;

  const fneId = row.fne_id as string;
  const t0 = Date.now();

  await supabase
    .from("fne_factures")
    .update({ statut: "submitted", submitted_at: new Date().toISOString() })
    .eq("fne_id", fneId);

  try {
    const resp = await submitToDGI(fneId, settings);
    const qr = await generateQR(resp.token).catch(() => null);
    await supabase
      .from("fne_factures")
      .update({
        statut: "accepted",
        code_dgi: resp.reference,
        token: resp.token,
        qr_code: qr,
        verification_url: `${settings.dgi_api_url_test || "http://54.247.95.108/ws"}/verify/${resp.token}`,
        response_payload: resp as never,
        balance_sticker: resp.balance_sticker,
        validated_at: new Date().toISOString(),
        source: resp.source,
      })
      .eq("fne_id", fneId);
    await supabase.from("fne_logs").insert({
      fne_facture_id: fneId,
      action: "fne_certification_success",
      statut: "succes",
      http_status: 200,
      attempt_number: 1,
      duration_ms: Date.now() - t0,
      payload: payload as never,
      response: resp as never,
    });
    return {
      success: true,
      fne_id: fneId,
      code_dgi: resp.reference,
      token: resp.token,
      qr_code: qr,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("fne_factures")
      .update({ statut: "error", error_message: msg })
      .eq("fne_id", fneId);
    await supabase.from("fne_logs").insert({
      fne_facture_id: fneId,
      action: "fne_certification_error",
      statut: "echec",
      http_status: null,
      attempt_number: 1,
      duration_ms: Date.now() - t0,
      payload: payload as never,
      response: { error: msg },
    });
    throw err;
  }
}

export async function submitFactureToFNE(facture: {
  facture_id: string;
  reference: string;
  client_nom: string | null;
  montant_total: number;
  date_facture: string;
}) {
  const res = await submitFNEInvoice({
    facture_id: facture.facture_id,
    reference: facture.reference,
    clientCompanyName: facture.client_nom ?? "Client",
    template: "B2C",
    paymentMethod: "cash",
    items: [
      {
        reference: facture.reference,
        description: `Facture ${facture.reference}`,
        quantity: 1,
        amount: facture.montant_total,
        taxes: ["TVA"],
      },
    ],
  });
  return { fne_id: res.fne_id, code_dgi: res.code_dgi };
}

export async function refundFNEInvoice(fneId: string, items: { id: string; quantity: number }[]) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("fne.rembourser");
  const original = await getFNEInvoice(fneId);
  if (original.statut !== "accepted")
    throw new Error("Seule une facture certifiée peut faire l'objet d'un avoir");
  const settings = await loadFNESettings();
  const refundRef = `AVR-${original.reference}-${Date.now().toString(36).toUpperCase()}`;
  const refundAmount = items.reduce((s, it) => s + it.quantity, 0);
  const { data: refund, error } = await supabase
    .from("fne_factures")
    .insert({
      reference: refundRef,
      invoice_type: "purchase",
      client_nom: original.client_nom,
      template: original.template,
      payment_method: original.payment_method,
      montant: -refundAmount,
      date_emission: new Date().toISOString().slice(0, 10),
      statut: "accepted",
      parent_fne_id: fneId,
      code_dgi: `${original.code_dgi}-AVR`,
      token: crypto.randomUUID().replace(/-/g, ""),
      source: isProductionReady(settings) ? "dgi_api" : "sandbox",
      submitted_at: new Date().toISOString(),
      validated_at: new Date().toISOString(),
      items: items as never,
      notes: `Avoir de la facture ${original.reference}`,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("fne_logs").insert({
    fne_facture_id: refund.fne_id,
    action: "fne_refund_success",
    statut: "succes",
    payload: { fne_id: fneId, items } as never,
    response: { reference: refundRef } as never,
  });
  return refund;
}
