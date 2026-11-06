import { expect, it } from "vitest";
import { assertActiveAccount } from "./account-status";

it("autorise le compte actif", () => {
  expect(() => assertActiveAccount({ statut: "actif", actif: true })).not.toThrow();
});
it("refuse le compte suspendu", () => {
  expect(() => assertActiveAccount({ statut: "suspendu", actif: true })).toThrow();
});
it("refuse le compte verrouillé", () => {
  expect(() => assertActiveAccount({ statut: "verrouille", actif: true })).toThrow();
});
it("refuse un profil absent", () => {
  expect(() => assertActiveAccount(null)).toThrow();
});
it("refuse un indicateur actif désactivé", () => {
  expect(() => assertActiveAccount({ statut: "actif", actif: false })).toThrow();
});