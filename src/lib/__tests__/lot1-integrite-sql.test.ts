import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Contrôle statique de la migration du lot 1 : les règles métier sont
// exécutées en base, ce test garantit qu'elles ne disparaissent pas du SQL.
const sql = readFileSync(
  resolve(__dirname, "../../../drizzle/migrations/0057_lot1_integrite_encaissements_retours_transferts.sql"),
  "utf8",
);

function fn(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION", start + 10);
  return sql.slice(start, next === -1 ? undefined : next);
}

describe("lot 1 — encaissé = paiements validés uniquement", () => {
  it("facture_encaisse ne compte que le statut valide", () => {
    expect(fn("facture_encaisse")).toContain("p.statut = 'valide'");
  });
  it("le recalcul de facture passe par facture_encaisse", () => {
    const f = fn("recalc_facture_from_payment_allocations");
    expect(f).toContain("public.facture_encaisse(_facture_id)");
    expect(f).not.toContain("NOT IN ('annule', 'rejete')");
  });
});

describe("lot 1 — annulation d'un retour", () => {
  const f = fn("annuler_retour");
  it("n'inverse que les entrées de stock réellement créées", () => {
    expect(f).toContain("sm.type = 'entree'");
    expect(f).not.toContain("FROM public.retour_lignes");
  });
  it("refuse un stock négatif", () => {
    expect(f).toContain("Stock insuffisant pour annuler le retour");
  });
  it("ne modifie le total de facture que pour les retours historiques sans option", () => {
    const idx = f.indexOf("montant_total = montant_total + v_r.montant");
    const guard = f.indexOf("v_option IS NULL AND v_r.statut = 'cloture'");
    expect(guard).toBeGreaterThan(0);
    expect(idx).toBeGreaterThan(guard);
  });
  it("bloque l'annulation si l'avoir est déjà imputé", () => {
    expect(f).toContain("traitement manuel requis");
  });
});

describe("lot 1 — suppression définitive d'un retour", () => {
  const f = fn("supprimer_retour_definitif");
  it("n'avale plus l'erreur d'annulation", () => {
    expect(f).not.toMatch(/EXCEPTION WHEN OTHERS THEN\s+--[^\n]*\n\s*NULL/);
    expect(f).not.toContain("WHEN OTHERS");
  });
  it("garde un instantané avant suppression", () => {
    expect(f.indexOf("retours_suppression_audit")).toBeLessThan(f.indexOf("DELETE FROM public.retours"));
  });
});

describe("lot 1 — transferts verrouillés", () => {
  for (const name of ["executer_transfert", "receptionner_transfert", "annuler_transfert"]) {
    it(`${name} verrouille le transfert`, () => {
      expect(fn(name)).toMatch(/FROM public\.transferts WHERE transfert_id = _transfert_id FOR UPDATE/);
    });
  }
  it("les lignes sont traitées par produit (anti-interblocage)", () => {
    expect(fn("executer_transfert")).toContain("ORDER BY produit_id");
    expect(fn("valider_commande")).toContain("ORDER BY cl.produit_id");
  });
});
