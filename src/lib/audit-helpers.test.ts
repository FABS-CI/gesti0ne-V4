import { describe, it, expect } from "vitest";
import { diffAuditValues } from "./audit-helpers";

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
