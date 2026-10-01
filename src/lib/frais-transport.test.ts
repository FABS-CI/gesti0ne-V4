import { describe, it, expect } from "vitest";
import {
  normaliserFraisTransport,
  montantFraisTransport,
  totalAvecTransport,
} from "./frais-transport";
import { totauxDepuisLignes } from "./frais-transport-api";

describe("normaliserFraisTransport", () => {
  it("« aucun » ou type absent => pas de frais", () => {
    expect(normaliserFraisTransport("aucun", 30000)).toEqual({ type: null, montant: null });
    expect(normaliserFraisTransport(null, 30000)).toEqual({ type: null, montant: null });
    expect(normaliserFraisTransport(undefined, undefined)).toEqual({ type: null, montant: null });
  });

  it("livraison / expédition conservent le montant", () => {
    expect(normaliserFraisTransport("livraison", 30000)).toEqual({
      type: "livraison",
      montant: 30000,
    });
    expect(normaliserFraisTransport("expedition", "1500")).toEqual({
      type: "expedition",
      montant: 1500,
    });
  });

  it("montant invalide ou négatif => 0", () => {
    expect(normaliserFraisTransport("livraison", "abc").montant).toBe(0);
    expect(normaliserFraisTransport("livraison", -500).montant).toBe(0);
    expect(normaliserFraisTransport("livraison", null).montant).toBe(0);
  });
});

describe("montantFraisTransport / totalAvecTransport", () => {
  it("aucun frais => 0 ajouté", () => {
    expect(montantFraisTransport({ type: null, montant: null })).toBe(0);
    expect(totalAvecTransport(600000, { type: null, montant: null })).toBe(600000);
  });

  it("les frais sont comptés une seule fois dans le total", () => {
    const frais = { type: "livraison" as const, montant: 30000 };
    expect(totalAvecTransport(600000, frais)).toBe(630000);
  });
});

describe("totauxDepuisLignes (rapport des frais)", () => {
  it("sépare livraison et expédition, total = somme des lignes", () => {
    const lignes = [
      { type_frais_transport: "livraison", montant_frais_transport: 10000 },
      { type_frais_transport: "livraison", montant_frais_transport: 5000 },
      { type_frais_transport: "expedition", montant_frais_transport: 2500 },
    ] as never;
    expect(totauxDepuisLignes(lignes)).toEqual({
      total: 17500,
      livraison: 15000,
      expedition: 2500,
      nb: 3,
    });
  });

  it("liste vide => tous les totaux à 0", () => {
    expect(totauxDepuisLignes([])).toEqual({ total: 0, livraison: 0, expedition: 0, nb: 0 });
  });
});
