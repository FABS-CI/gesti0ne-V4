import { describe, it, expect } from "vitest";
import { diffAuditValues, matchesAuditFilters, type AuditRow } from "./audit-helpers";

const row = (over: Partial<AuditRow>): AuditRow =>
  ({
    id: "1",
    user_email: "jane@fabs.net",
    user_id: null,
    action: "DELETE",
    module: null,
    table_name: "factures",
    record_id: "abc",
    record_ref: "FAC-2026-00042",
    occurred_at: "2026-11-11T08:00:00Z",
    old_values: null,
    new_values: null,
    changes: null,
    ip_address: null,
    user_agent: null,
    url: "/factures",
    http_method: null,
    status: "success",
    duration_ms: null,
    ...over,
  }) as AuditRow;

describe("matchesAuditFilters", () => {
  it("garde tous les événements sans filtre", () => {
    expect(matchesAuditFilters(row({}), { userFilter: "", actionFilter: "", search: "" })).toBe(true);
  });

  it("ne garde que l'action demandée", () => {
    expect(matchesAuditFilters(row({ action: "INSERT" }), { actionFilter: "DELETE" })).toBe(false);
    expect(matchesAuditFilters(row({ action: "DELETE" }), { actionFilter: "DELETE" })).toBe(true);
  });

  it("ne garde que l'utilisateur demandé", () => {
    expect(matchesAuditFilters(row({}), { userFilter: "other@fabs.net" })).toBe(false);
    expect(matchesAuditFilters(row({}), { userFilter: "jane@fabs.net" })).toBe(true);
  });

  it("trouve un événement par son libellé français d'action", () => {
    expect(matchesAuditFilters(row({ action: "DELETE" }), { search: "suppression" })).toBe(true);
    expect(matchesAuditFilters(row({ action: "INSERT" }), { search: "suppression" })).toBe(false);
  });

  it("trouve un événement par référence, url ou module", () => {
    expect(matchesAuditFilters(row({}), { search: "fac-2026-00042" })).toBe(true);
    expect(matchesAuditFilters(row({}), { search: "factures" })).toBe(true);
    expect(matchesAuditFilters(row({}), { search: "/factures" })).toBe(true);
  });

  it("ignore la casse et les espaces de recherche", () => {
    expect(matchesAuditFilters(row({}), { search: "  FAC-2026-00042  " })).toBe(true);
  });
});

describe("diffAuditValues", () => {
  it("détecte les champs modifiés", () => {
    const d = diffAuditValues({ statut: "en_attente", montant: 100 }, { statut: "valide", montant: 100 });
    expect(d).toEqual([{ champ: "statut", avant: "en_attente", apres: "valide", kind: "modifie" }]);
  });

  it("détecte les champs ajoutés et supprimés", () => {
    const d = diffAuditValues({ a: 1 }, { b: 2 });
    expect(d).toEqual([
      { champ: "a", avant: "1", apres: "—", kind: "supprime" },
      { champ: "b", avant: "—", apres: "2", kind: "ajoute" },
    ]);
  });

  it("ignore les champs inchangés, y compris objets identiques", () => {
    expect(diffAuditValues({ a: { x: 1 }, b: 2 }, { a: { x: 1 }, b: 2 })).toEqual([]);
  });

  it("gère les valeurs nulles et non-objets", () => {
    expect(diffAuditValues(null, null)).toEqual([]);
    expect(diffAuditValues(null, { a: null })).toEqual([
      { champ: "a", avant: "—", apres: "—", kind: "ajoute" },
    ]);
  });
});
