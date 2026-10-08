import { describe, it, expect } from "vitest";
import { findNavTrail } from "./TopbarBreadcrumb";

describe("findNavTrail", () => {
  it("retrouve le menu d'une fiche à partir de sa liste", () => {
    const t = findNavTrail("/factures/abc");
    expect(t?.item).toBeTruthy();
  });
  it("ne renvoie rien pour une adresse inconnue", () => {
    expect(findNavTrail("/zzz-inconnu")).toBeNull();
  });
});
