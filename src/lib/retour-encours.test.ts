import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { retourEncoursMessage } from "./retour-encours";

describe("plafond des retours", () => {
  it("solde nul : interdit", () => expect(retourEncoursMessage({ solde: 0, reserve: 0, disponible: 0 }, 1)).not.toBeNull());
  it("solde créditeur : interdit", () => expect(retourEncoursMessage({ solde: -100, reserve: 0, disponible: 0 }, 1)).not.toBeNull());
  it("100 000 FCFA de dette : autorisé exactement jusqu'à 100 000", () => {
    expect(retourEncoursMessage({ solde: 100_000, reserve: 0, disponible: 100_000 }, 100_000)).toBeNull();
    expect(retourEncoursMessage({ solde: 100_000, reserve: 0, disponible: 100_000 }, 100_001)).not.toBeNull();
  });
  it("500 000 FCFA de dette : 300 000 autorisé", () => expect(retourEncoursMessage({ solde: 500_000, reserve: 0, disponible: 500_000 }, 300_000)).toBeNull());
  it("500 000 FCFA de dette : 600 000 refusé", () => expect(retourEncoursMessage({ solde: 500_000, reserve: 0, disponible: 500_000 }, 600_000)).not.toBeNull());
  it("300 000 déjà réservé sur 500 000 : seconde demande de 300 000 refusée", () => expect(retourEncoursMessage({ solde: 500_000, reserve: 300_000, disponible: 200_000 }, 300_000)).not.toBeNull());
});