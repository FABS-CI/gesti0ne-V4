import { describe, expect, it } from "vitest";
import { DgiSignRefused } from "@/lib/fne/dgi-sign-rules";
import {
  assertFneRowRefundable,
  buildRefundLines,
  dgiRefundTarget,
  refundTotal,
  refundedQuantities,
  type FneRowForRefund,
} from "@/lib/fne/dgi-refund-rules";

const row = (over: Partial<FneRowForRefund> = {}): FneRowForRefund => ({
  fne_id: "11111111-1111-1111-1111-111111111111",
  facture_id: "22222222-2222-2222-2222-222222222222",
  reference: "FAC-2026-00072",
  statut: "accepted",
  code_dgi: "9606123E25000000019",
  invoice_type: "sale",
  parent_fne_id: null,
  source: "dgi_api",
  items: [{ reference: "FAC-2026-00072", description: "Facture", quantity: 1, amount: 811200 }],
  response_payload: { invoice: { id: "dgi-inv-1" }, items: [{ id: "dgi-item-1" }] },
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DgiSignRefused ? e.code : "autre";
  }
  return null;
};

describe("Avoir FNE", () => {
  it("rembourse le montant réel de la facture, pas la somme des quantités", () => {
    const lines = buildRefundLines(row(), new Map());
    expect(refundTotal(lines)).toBe(811200);
    expect(lines).toEqual([
      expect.objectContaining({ index: 0, quantity: 1, amount: 811200 }),
    ]);
  });

  it("applique les remises de ligne et rembourse une quantité partielle", () => {
    const r = row({
      items: [
        { reference: "L1", description: "Livre A", quantity: 10, amount: 2000, discount: 10 },
        { reference: "L2", description: "Livre B", quantity: 5, amount: 3000 },
      ],
    });
    const lines = buildRefundLines(r, new Map(), [{ index: 0, quantity: 4 }]);
    expect(refundTotal(lines)).toBe(7200);
  });

  it("ne rembourse jamais plus que le reste après les avoirs déjà émis", () => {
    const r = row({
      items: [{ reference: "L1", description: "Livre", quantity: 10, amount: 1000 }],
    });
    const deja = refundedQuantities([{ items: [{ index: 0, quantity: 7 }] }]);
    expect(refundTotal(buildRefundLines(r, deja))).toBe(3000);
    expect(code(() => buildRefundLines(r, deja, [{ index: 0, quantity: 4 }]))).toBe("montant");
    const tout = refundedQuantities([{ items: [{ index: 0, quantity: 10 }] }]);
    expect(code(() => buildRefundLines(r, tout))).toBe("deja_signee");
  });

  it("refuse les lignes inconnues, en double ou les quantités nulles", () => {
    expect(code(() => buildRefundLines(row(), new Map(), [{ index: 3, quantity: 1 }]))).toBe(
      "introuvable",
    );
    expect(
      code(() =>
        buildRefundLines(row(), new Map(), [
          { index: 0, quantity: 0.5 },
          { index: 0, quantity: 0.5 },
        ]),
      ),
    ).toBe("introuvable");
    expect(code(() => buildRefundLines(row(), new Map(), [{ index: 0, quantity: 0 }]))).toBe(
      "montant",
    );
  });

  it("n'accepte qu'une facture de vente certifiée", () => {
    expect(code(() => assertFneRowRefundable(row()))).toBeNull();
    expect(code(() => assertFneRowRefundable(null))).toBe("introuvable");
    expect(code(() => assertFneRowRefundable(row({ statut: "error" })))).toBe("introuvable");
    expect(code(() => assertFneRowRefundable(row({ code_dgi: null })))).toBe("introuvable");
    expect(code(() => assertFneRowRefundable(row({ parent_fne_id: "x" })))).toBe("introuvable");
  });

  it("relit les identifiants DGI conservés à la certification", () => {
    expect(dgiRefundTarget(row().response_payload)).toEqual({
      invoiceId: "dgi-inv-1",
      itemIds: ["dgi-item-1"],
    });
    expect(
      dgiRefundTarget({ invoice: { id: "i", items: [{ id: "a" }, { id: "b" }] } }),
    ).toEqual({ invoiceId: "i", itemIds: ["a", "b"] });
    // Factures certifiées avant la correction : pas d'identifiant de ligne, pas d'avoir automatique.
    expect(dgiRefundTarget({ invoice: { id: "i" } })).toBeNull();
    expect(dgiRefundTarget(null)).toBeNull();
  });
});
