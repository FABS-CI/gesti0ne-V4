import { describe, expect, it } from "vitest";
import {
  DGI_SIGN_RATE_LIMIT_PER_MINUTE,
  DgiSignRefused,
  assertFneRowSignable,
  assertRateLimit,
  buildPayloadFromFacture,
  type FneRowForSign,
} from "@/lib/fne/dgi-sign-rules";
import { queryCacheBuster, removePersistedQueryCache, userChanged } from "@/lib/query-cache-user";
import { isProductionHost, securityHeadersFor } from "@/lib/security-headers";

const row = (over: Partial<FneRowForSign> = {}): FneRowForSign => ({
  fne_id: "11111111-1111-1111-1111-111111111111",
  facture_id: "22222222-2222-2222-2222-222222222222",
  reference: "FAC-2026-00072",
  statut: "submitted",
  code_dgi: null,
  montant: 811200,
  template: "B2C",
  payment_method: "cash",
  invoice_type: "sale",
  client_nom: "NOM MODIFIÉ PAR LE NAVIGATEUR",
  client_ncc: "FAUX",
  client_telephone: null,
  client_email: null,
  client_seller_name: null,
  commercial_message: "message injecté",
  footer: null,
  items: [{ reference: "X", description: "faux", quantity: 1, amount: 1 }],
  discount: 999,
  ...over,
});
const facture = {
  facture_id: "22222222-2222-2222-2222-222222222222",
  reference: "FAC-2026-00072",
  statut: "partielle",
  montant_total: 811200,
  client_nom: "IEP GBONE",
};
const client = { nom: "IEP GBONE", telephone: "0700000000", email: null, nif: "123A" };

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DgiSignRefused ? e.code : "autre";
  }
  return null;
};

describe("Lot 2.2 — signature DGI", () => {
  it("refuse une facture déjà signée (un seul appel DGI)", () => {
    expect(code(() => assertFneRowSignable(row({ statut: "accepted" }), false))).toBe("deja_signee");
    expect(code(() => assertFneRowSignable(row(), true))).toBe("deja_signee");
    expect(code(() => assertFneRowSignable(row(), false))).toBeNull();
  });

  it("refuse une facture annulée", () => {
    expect(code(() => buildPayloadFromFacture(row(), { ...facture, statut: "annulee" }, client))).toBe(
      "annulee",
    );
  });

  it("refuse un montant différent du total enregistré", () => {
    expect(code(() => buildPayloadFromFacture(row({ montant: 811199 }), facture, client))).toBe("montant");
  });

  it("ignore le contenu envoyé par le navigateur et relit la base", () => {
    const p = buildPayloadFromFacture(row(), facture, client);
    expect(p.clientCompanyName).toBe("IEP GBONE");
    expect(p.clientNcc).toBe("123A");
    expect(p.commercialMessage).toBeNull();
    expect(p.discount).toBe(0);
    expect(p.items).toEqual([
      {
        reference: "FAC-2026-00072",
        description: "Facture FAC-2026-00072",
        quantity: 1,
        amount: 811200,
        taxes: ["TVA"],
      },
    ]);
  });

  it(`limite à ${DGI_SIGN_RATE_LIMIT_PER_MINUTE} appels par minute et par utilisateur`, () => {
    expect(code(() => assertRateLimit(DGI_SIGN_RATE_LIMIT_PER_MINUTE - 1))).toBeNull();
    expect(code(() => assertRateLimit(DGI_SIGN_RATE_LIMIT_PER_MINUTE))).toBe("rate_limit");
  });
});

describe("Lot 2.5 — cache local par utilisateur", () => {
  it("le cache d'un compte n'est jamais relu par un autre compte", () => {
    expect(queryCacheBuster("A")).not.toBe(queryCacheBuster("B"));
  });
  it("détecte connexion, déconnexion et changement de compte", () => {
    expect(userChanged(undefined, "A")).toBe(false);
    expect(userChanged("A", null)).toBe(true);
    expect(userChanged("A", "B")).toBe(true);
    expect(userChanged("A", "A")).toBe(false);
  });
  it("supprime la clé fabs-query-cache", () => {
    const removed: string[] = [];
    removePersistedQueryCache({ removeItem: (k: string) => void removed.push(k) });
    expect(removed).toEqual(["fabs-query-cache"]);
  });
});

describe("Lot 2.6 — en-têtes de sécurité", () => {
  it("pose les en-têtes de base et jamais d'interdiction de cadre", () => {
    const h = securityHeadersFor("gesti0ne.lovable.app");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Content-Security-Policy-Report-Only"]).toBeTruthy();
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["X-Frame-Options"]).toBeUndefined();
    expect(h["Content-Security-Policy-Report-Only"]).not.toContain("frame-ancestors 'none'");
  });
  it("HSTS en production uniquement", () => {
    expect(isProductionHost("gesti0ne.lovable.app")).toBe(true);
    expect(isProductionHost("localhost:8080")).toBe(false);
    expect(isProductionHost("id-preview--abc.lovable.app")).toBe(false);
    expect(securityHeadersFor("localhost:8080")["Strict-Transport-Security"]).toBeUndefined();
    expect(securityHeadersFor("gesti0ne.lovable.app")["Strict-Transport-Security"]).toContain("max-age");
  });
});
