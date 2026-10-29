import { describe, it, expect } from "vitest";
import { eligibilitePaie } from "./eligibilite";

const OCT = ["2026-10-01", "2026-10-31"] as const;
const base = {
  actif: true,
  statut_employe: "actif",
  date_embauche: "2020-01-15",
  date_fin_contrat: null,
};

describe("eligibilitePaie — salariés proposés à la génération mensuelle", () => {
  it("salarié actif embauché avant la période : proposé", () => {
    expect(eligibilitePaie(base, ...OCT)).toEqual({ eligible: true });
  });

  it("statut absent (anciennes fiches) : traité comme actif", () => {
    expect(eligibilitePaie({ ...base, statut_employe: null }, ...OCT).eligible).toBe(true);
  });

  it.each([
    ["suspendu", "Salarié suspendu"],
    ["demission", "Démission"],
    ["licencie", "Licencié"],
    ["retraite", "Retraité"],
    ["fin_contrat", "Fin de contrat"],
  ])("statut %s : exclu avec la raison « %s »", (statut, raison) => {
    expect(eligibilitePaie({ ...base, statut_employe: statut }, ...OCT)).toEqual({
      eligible: false,
      raison,
    });
  });

  it("fiche inactive ou archivée : exclue", () => {
    expect(eligibilitePaie({ ...base, actif: false }, ...OCT).eligible).toBe(false);
    expect(eligibilitePaie({ ...base, deleted_at: "2026-01-01T00:00:00Z" }, ...OCT).eligible).toBe(
      false,
    );
  });

  it("embauche : le dernier jour de la période est inclus, le lendemain exclu", () => {
    expect(eligibilitePaie({ ...base, date_embauche: "2026-10-31" }, ...OCT).eligible).toBe(true);
    expect(eligibilitePaie({ ...base, date_embauche: "2026-11-01" }, ...OCT)).toEqual({
      eligible: false,
      raison: "Embauché après la période",
    });
  });

  it("fin de contrat : le premier jour de la période est inclus, la veille exclue", () => {
    expect(eligibilitePaie({ ...base, date_fin_contrat: "2026-10-01" }, ...OCT).eligible).toBe(
      true,
    );
    expect(eligibilitePaie({ ...base, date_fin_contrat: "2026-09-30" }, ...OCT)).toEqual({
      eligible: false,
      raison: "Contrat terminé avant la période",
    });
  });

  it("l'ancien champ « statut » n'est plus lu", () => {
    // L'ancien filtre lisait e.statut (inexistant) : un licencié passait toujours.
    const ancien = { ...base, statut_employe: "licencie", statut: "actif" } as Parameters<
      typeof eligibilitePaie
    >[0];
    expect(eligibilitePaie(ancien, ...OCT).eligible).toBe(false);
  });
});
