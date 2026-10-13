/**
 * Règles pures de la signature DGI (Lot 2.2) — testables sans réseau ni base.
 * Le serveur relit tout en base : rien de ce que le navigateur envoie
 * (hors identifiant de la ligne FNE) n'entre dans la requête DGI.
 */

export const DGI_SIGN_RATE_LIMIT_PER_MINUTE = 5;

export type FneRowForSign = {
  fne_id: string;
  facture_id: string | null;
  reference: string;
  statut: string;
  code_dgi: string | null;
  montant: number | null;
  template: string | null;
  payment_method: string | null;
  invoice_type: string | null;
  client_nom: string | null;
  client_ncc: string | null;
  client_telephone: string | null;
  client_email: string | null;
  client_seller_name: string | null;
  commercial_message: string | null;
  footer: string | null;
  items: unknown;
  discount: number | null;
};

export type FactureForSign = {
  facture_id: string;
  reference: string;
  statut: string | null;
  montant_total: number;
  client_nom: string | null;
};

export type ClientForSign = {
  nom: string | null;
  telephone: string | null;
  email: string | null;
  nif: string | null;
} | null;

export type DgiItem = {
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount?: number;
  measurementUnit?: string;
  taxes?: string[];
};

export type DgiPayload = {
  reference?: string;
  invoiceType: "sale" | "purchase";
  paymentMethod: string;
  template: "B2B" | "B2C" | "B2G" | "B2F";
  clientNcc: string | null;
  clientCompanyName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientSellerName: string | null;
  commercialMessage: string | null;
  footer: string | null;
  items: DgiItem[];
  discount: number;
};

export class DgiSignRefused extends Error {
  constructor(
    public code:
      | "permission"
      | "rate_limit"
      | "introuvable"
      | "deja_signee"
      | "annulee"
      | "montant"
      | "en_cours",
    message: string,
  ) {
    super(message);
    this.name = "DgiSignRefused";
  }
}

const TEMPLATES = new Set(["B2B", "B2C", "B2G", "B2F"]);
const toTemplate = (t: string | null): DgiPayload["template"] =>
  (t && TEMPLATES.has(t) ? t : "B2C") as DgiPayload["template"];

/** Arrondi au franc pour comparer des montants FCFA sans bruit de virgule flottante. */
const sameAmount = (a: number, b: number) => Math.round(a) === Math.round(b);

export function assertRateLimit(callsLastMinute: number) {
  if (callsLastMinute >= DGI_SIGN_RATE_LIMIT_PER_MINUTE) {
    throw new DgiSignRefused(
      "rate_limit",
      `Trop de demandes de signature DGI (maximum ${DGI_SIGN_RATE_LIMIT_PER_MINUTE} par minute). Réessayez dans un instant.`,
    );
  }
}

/** Vérifie que la ligne FNE peut être signée (idempotence). */
export function assertFneRowSignable(row: FneRowForSign | null, alreadySignedForFacture: boolean) {
  if (!row) throw new DgiSignRefused("introuvable", "Demande de certification introuvable.");
  if (row.statut === "accepted" || row.code_dgi || alreadySignedForFacture) {
    throw new DgiSignRefused("deja_signee", "Cette facture est déjà signée par la DGI.");
  }
}

/**
 * Construit la requête DGI d'une facture de l'ERP uniquement à partir des
 * données en base. Format identique à l'envoi historique (une ligne au total
 * de la facture), donc aucun changement de ce que reçoit la DGI.
 */
export function buildPayloadFromFacture(
  row: FneRowForSign,
  facture: FactureForSign | null,
  client: ClientForSign,
): DgiPayload {
  if (!facture) throw new DgiSignRefused("introuvable", "Facture introuvable.");
  const statut = (facture.statut ?? "").toLowerCase();
  if (statut === "annulee" || statut === "annulée") {
    throw new DgiSignRefused("annulee", "Une facture annulée ne peut pas être signée.");
  }
  const total = Number(facture.montant_total ?? 0);
  if (row.montant == null || !sameAmount(Number(row.montant), total)) {
    throw new DgiSignRefused(
      "montant",
      "Le montant de la demande ne correspond pas au total de la facture enregistrée.",
    );
  }
  return {
    reference: facture.reference,
    invoiceType: "sale",
    paymentMethod: row.payment_method ?? "cash",
    template: toTemplate(row.template),
    clientNcc: client?.nif ?? null,
    clientCompanyName: client?.nom ?? facture.client_nom ?? "Client",
    clientPhone: client?.telephone ?? null,
    clientEmail: client?.email ?? null,
    clientSellerName: null,
    commercialMessage: null,
    footer: null,
    items: [
      {
        reference: facture.reference,
        description: `Facture ${facture.reference}`,
        quantity: 1,
        amount: total,
        taxes: ["TVA"],
      },
    ],
    discount: 0,
  };
}

/** Facture FNE saisie manuellement (sans facture ERP) : relue depuis la ligne enregistrée. */
export function buildPayloadFromManualRow(row: FneRowForSign): DgiPayload {
  const items = Array.isArray(row.items) ? (row.items as DgiItem[]) : [];
  return {
    reference: row.reference,
    invoiceType: row.invoice_type === "purchase" ? "purchase" : "sale",
    paymentMethod: row.payment_method ?? "cash",
    template: toTemplate(row.template),
    clientNcc: row.client_ncc,
    clientCompanyName: row.client_nom ?? "Client",
    clientPhone: row.client_telephone,
    clientEmail: row.client_email,
    clientSellerName: row.client_seller_name,
    commercialMessage: row.commercial_message,
    footer: row.footer,
    items: items.map((it) => ({
      reference: String(it.reference ?? ""),
      description: String(it.description ?? ""),
      quantity: Number(it.quantity ?? 1),
      amount: Number(it.amount ?? 0),
      ...(it.discount != null ? { discount: Number(it.discount) } : {}),
      ...(it.measurementUnit ? { measurementUnit: String(it.measurementUnit) } : {}),
      ...(Array.isArray(it.taxes) ? { taxes: it.taxes.map(String) } : {}),
    })),
    discount: Number(row.discount ?? 0),
  };
}
