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

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { toneForStatut as t2 } from "./statut-tone";
d2("toneForStatut — incidents et inventaires", () => {
  i2("résolu et régularisé sont en succès", () => {
    e2(t2("resolu")).toBe("success");
    e2(t2("regularise")).toBe("success");
  });
  i2("ouvert et déclaré sont à surveiller", () => {
    e2(t2("ouvert")).toBe("warning");
    e2(t2("declare")).toBe("warning");
  });
});
