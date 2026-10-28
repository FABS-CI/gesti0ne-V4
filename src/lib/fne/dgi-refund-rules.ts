/**
 * Règles pures des avoirs FNE — testables sans réseau ni base.
 * Le serveur relit la facture certifiée et ses avoirs déjà émis : le navigateur
 * n'envoie que l'identifiant de la facture et, au besoin, les quantités à rembourser.
 */

import { DgiSignRefused, type DgiItem } from "./dgi-sign-rules";

export type FneRowForRefund = {
  fne_id: string;
  facture_id: string | null;
  reference: string | null;
  statut: string;
  code_dgi: string | null;
  invoice_type: string | null;
  parent_fne_id: string | null;
  source: string | null;
  items: unknown;
  response_payload: unknown;
};

/** Ligne d'avoir : `index` = position de la ligne dans la facture certifiée. */
export type RefundLine = {
  index: number;
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount?: number;
  taxes?: string[];
};

export type RefundRequest = { index: number; quantity: number }[];

/** Montant d'une ligne, remise de ligne (%) déduite, comme lors de la certification. */
const lineTotal = (it: { quantity: number; amount: number; discount?: number }) =>
  it.quantity * it.amount * (1 - (it.discount ?? 0) / 100);

export const refundTotal = (lines: RefundLine[]) =>
  Math.round(lines.reduce((s, l) => s + lineTotal(l), 0));

function originalItems(row: FneRowForRefund): DgiItem[] {
  return Array.isArray(row.items) ? (row.items as DgiItem[]) : [];
}

/** Seule une facture de vente certifiée (et pas un avoir) peut recevoir un avoir. */
export function assertFneRowRefundable(row: FneRowForRefund | null): asserts row is FneRowForRefund {
  if (!row) throw new DgiSignRefused("introuvable", "Facture certifiée introuvable.");
  if (row.parent_fne_id || row.invoice_type === "refund") {
    throw new DgiSignRefused("introuvable", "Un avoir ne peut pas faire l'objet d'un autre avoir.");
  }
  if (row.statut !== "accepted" || !row.code_dgi) {
    throw new DgiSignRefused("introuvable", "Seule une facture certifiée peut faire l'objet d'un avoir.");
  }
}

/** Quantités déjà remboursées par ligne, à partir des avoirs certifiés existants. */
export function refundedQuantities(avoirs: { items: unknown }[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const a of avoirs) {
    for (const it of Array.isArray(a.items) ? (a.items as Partial<RefundLine>[]) : []) {
      if (typeof it.index !== "number") continue;
      out.set(it.index, (out.get(it.index) ?? 0) + Number(it.quantity ?? 0));
    }
  }
  return out;
}

/**
 * Lignes de l'avoir. Sans demande précise : tout le reste à rembourser.
 * Refuse toute quantité supérieure à ce qui reste sur la ligne.
 */
export function buildRefundLines(
  row: FneRowForRefund,
  dejaRembourse: Map<number, number>,
  demande?: RefundRequest,
): RefundLine[] {
  const items = originalItems(row);
  const reste = (i: number) => Number(items[i].quantity ?? 0) - (dejaRembourse.get(i) ?? 0);
  const wanted = demande?.length
    ? demande
    : items.map((_, index) => ({ index, quantity: reste(index) })).filter((d) => d.quantity > 0);

  const seen = new Set<number>();
  const lines = wanted.map(({ index, quantity }) => {
    if (!Number.isInteger(index) || index < 0 || index >= items.length || seen.has(index)) {
      throw new DgiSignRefused("introuvable", "Ligne d'avoir invalide.");
    }
    seen.add(index);
    if (!(quantity > 0) || quantity > reste(index) + 1e-9) {
      throw new DgiSignRefused(
        "montant",
        `Quantité à rembourser invalide pour la ligne ${index + 1} (reste ${reste(index)}).`,
      );
    }
    const it = items[index];
    return {
      index,
      reference: String(it.reference ?? ""),
      description: String(it.description ?? ""),
      quantity,
      amount: Number(it.amount ?? 0),
      ...(it.discount != null ? { discount: Number(it.discount) } : {}),
      ...(Array.isArray(it.taxes) ? { taxes: it.taxes.map(String) } : {}),
    };
  });
  if (lines.length === 0) {
    throw new DgiSignRefused("deja_signee", "Cette facture est déjà entièrement remboursée.");
  }
  return lines;
}

/**
 * Identifiants DGI de la facture et de ses lignes, conservés dans la réponse
 * de certification (`response_payload`). Indispensables pour l'appel d'avoir.
 */
export function dgiRefundTarget(
  responsePayload: unknown,
): { invoiceId: string; itemIds: string[] } | null {
  const p = (responsePayload ?? {}) as {
    invoice?: { id?: unknown; items?: unknown };
    items?: unknown;
  };
  const invoiceId = typeof p.invoice?.id === "string" ? p.invoice.id : null;
  const raw = Array.isArray(p.items) ? p.items : Array.isArray(p.invoice?.items) ? p.invoice.items : [];
  const itemIds = (raw as { id?: unknown }[]).map((it) => (typeof it?.id === "string" ? it.id : ""));
  if (!invoiceId || itemIds.length === 0 || itemIds.some((id) => !id)) return null;
  return { invoiceId, itemIds };
}
