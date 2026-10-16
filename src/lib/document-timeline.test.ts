import { describe, it, expect } from "vitest";
import { timelineKindLabel } from "./document-timeline";

describe("timelineKindLabel", () => {
  it("traduit les types connus", () => {
    expect(timelineKindLabel("statut")).toBe("Statut");
    expect(timelineKindLabel("fne")).toBe("DGI");
    expect(timelineKindLabel("annulation_paiement")).toBe("Annulation de paiement");
  });
  it("affiche « Autre » pour un type inconnu", () => {
    expect(timelineKindLabel("xyz")).toBe("Autre");
  });
});
