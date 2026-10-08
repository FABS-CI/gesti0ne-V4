import { describe, it, expect } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("doublon → quoi + que faire", () =>
    expect(friendlyError({ code: "23505", message: "duplicate key" })).toMatch(/existe déjà.*Recherchez/));
  it("permission refusée → demander un administrateur", () =>
    expect(friendlyError({ code: "42501", message: "x" })).toMatch(/administrateur/));
  it("élément référencé ailleurs", () =>
    expect(friendlyError({ message: "violates foreign key constraint" })).toMatch(/utilisé par d'autres documents/));
  it("message métier RPC conservé", () =>
    expect(friendlyError({ code: "P0001", message: "Montant supérieur au reste à payer" })).toBe("Montant supérieur au reste à payer"));
});
