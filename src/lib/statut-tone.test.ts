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
});
