import { describe, expect, it } from "vitest";
import { buildPaymentRows } from "./payment-rows";
import { getRecapTheme, normalizeRecapSettings, recapDocTypeFromLabel } from "./recap-themes";

describe("lignes de paiement du récap", () => {
  it("facture sans paiement : aucune ligne", () => {
    expect(buildPaymentRows("Facture", { montantPaye: 0 }, 1_000_000)).toEqual([]);
  });
  it("paiement partiel : payé et reste corrects", () => {
    expect(buildPaymentRows("Facture", { montantPaye: 400_000 }, 1_000_000)).toEqual([
      { label: "MONTANT PAYÉ", value: 400_000 },
      { label: "RESTE À PAYER", value: 600_000 },
    ]);
  });
  it("facture soldée : reste à payer 0", () => {
    const rows = buildPaymentRows("Facture", { montantPaye: 1_000_000 }, 1_000_000);
    expect(rows[1]).toEqual({ label: "RESTE À PAYER", value: 0 });
  });
  it.each(["Proforma", "Commande", "Bon de Livraison", "Avoir", "Bon de Retour", "Spécimens"])(
    "%s : jamais de lignes de paiement",
    (type) => {
      expect(buildPaymentRows(type, { montantPaye: 500 }, 1000)).toEqual([]);
    },
  );
});

describe("getRecapTheme", () => {
  const s = normalizeRecapSettings({ theme_global: "vert", theme_par_type: { facture: "indigo" } });
  it("override prioritaire", () => {
    expect(getRecapTheme("facture", "ardoise", s).id).toBe("ardoise");
  });
  it("thème du type avant le global", () => {
    expect(getRecapTheme("facture", null, s).id).toBe("indigo");
  });
  it("global pour un type sans thème propre", () => {
    expect(getRecapTheme("proforma", null, s).id).toBe("vert");
  });
  it("bleu par défaut si réglage vide ou invalide", () => {
    expect(getRecapTheme("facture", null, normalizeRecapSettings(null)).id).toBe("bleu");
    expect(
      getRecapTheme("facture", null, normalizeRecapSettings({ theme_global: "orange" })).id,
    ).toBe("bleu");
  });
  it("libellés du moteur PDF reconnus", () => {
    expect(recapDocTypeFromLabel("Reçu de Paiement")).toBe("recu");
    expect(recapDocTypeFromLabel("Relevé de Compte")).toBe("releve");
    expect(recapDocTypeFromLabel("Commande")).toBe("bon_commande");
  });
});
