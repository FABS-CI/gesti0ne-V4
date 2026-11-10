import { describe, expect, it } from "vitest";
import { toneForStatut } from "./statut-tone";

describe("toneForStatut", () => {
  it("inactif n'est pas confondu avec actif", () => {
    expect(toneForStatut("inactif")).toBe("neutral");
    expect(toneForStatut("actif")).toBe("success");
  });
  it("impayée reste en rouge", () => {
    expect(toneForStatut("impayee")).toBe("danger");
  });
  it("tournées", () => {
    expect(toneForStatut("terminee")).toBe("success");
    expect(toneForStatut("en_cours")).toBe("warning");
    expect(toneForStatut("annulee")).toBe("neutral");
  });
  it("contrats", () => {
    expect(toneForStatut("expire")).toBe("neutral");
    expect(toneForStatut("resilie")).toBe("danger");
    expect(toneForStatut("rejetee")).toBe("danger");
    expect(toneForStatut("validee")).toBe("success");
  });
  it("une attente de validation n'est pas en vert", () => {
    expect(toneForStatut("en_attente_validation")).toBe("warning");
    expect(toneForStatut("attente_validation_compta")).toBe("warning");
    expect(toneForStatut("annulation_en_attente")).toBe("warning");
    expect(toneForStatut("validee")).toBe("success");
  });
});
