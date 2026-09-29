import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Branchement production DGI (batch P1).
 *
 * Ce server-fn appelle réellement l'API DGI FNE
 * (POST {DGI_API_URL}/external/invoices/sign) en utilisant la clé stockée
 * uniquement côté serveur (`process.env.DGI_API_KEY`). Le client (navigateur)
 * ne voit jamais la clé — la RLS masque également `fne_settings.dgi_api_key`.
 *
 * Retour : forme identique à la sandbox pour que `submitToDGI` puisse
 * enchaîner sans branchement supplémentaire.
 */
const InvoiceItemSchema = z.object({
  reference: z.string(),
  description: z.string(),
  quantity: z.number(),
  amount: z.number(),
  discount: z.number().optional(),
  measurementUnit: z.string().optional(),
  taxes: z.array(z.string()).optional(),
});

const InvoiceSchema = z.object({
  reference: z.string().optional(),
  invoiceType: z.enum(["sale", "purchase"]).optional(),
  paymentMethod: z.string().optional(),
  template: z.enum(["B2B", "B2C", "B2G", "B2F"]).optional(),
  clientNcc: z.string().nullable().optional(),
  clientCompanyName: z.string(),
  clientPhone: z.string().nullable().optional(),
  clientEmail: z.string().nullable().optional(),
  clientSellerName: z.string().nullable().optional(),
  commercialMessage: z.string().nullable().optional(),
  footer: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema),
  discount: z.number().optional(),
});

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
  .inputValidator((data) => InvoiceSchema.parse(data))
  .handler(async ({ data }): Promise<DGISignResponse> => {
    const apiKey = process.env.DGI_API_KEY;
    const apiUrl = process.env.DGI_API_URL_PROD ?? "https://api.dgi.gouv.ci/ws";
    const companyNcc = process.env.DGI_COMPANY_NCC ?? "";
    if (!apiKey) {
      throw new Error(
        "DGI_API_KEY manquante côté serveur. Ajoutez le secret avant d'activer le mode production.",
      );
    }

    const resp = await fetch(`${apiUrl}/external/invoices/sign`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`DGI ${resp.status}: ${text.slice(0, 400)}`);
    }
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
    if (!reference || !token) {
      throw new Error("Réponse DGI incomplète (reference/token manquants)");
    }
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
  });