import { describe, it, expect } from "vitest";
import { isEmployeMatricule, withoutMatricule, employeCreeMessage } from "./employe-matricule";

describe("matricule employé EP-NN", () => {
  it("accepte EP-01, EP-99 et EP-100", () => {
    expect(isEmployeMatricule("EP-01")).toBe(true);
    expect(isEmployeMatricule("EP-99")).toBe(true);
    expect(isEmployeMatricule("EP-100")).toBe(true);
  });
  it("refuse les anciens formats et les saisies libres", () => {
    expect(isEmployeMatricule("EP-1")).toBe(false);
    expect(isEmployeMatricule("EMP-001")).toBe(false);
    expect(isEmployeMatricule("ep-01")).toBe(false);
    expect(isEmployeMatricule("")).toBe(false);
    expect(isEmployeMatricule(null)).toBe(false);
  });
  it("n'envoie jamais de matricule saisi à la main", () => {
    const sent = withoutMatricule({ nom_complet: "AKE", matricule: "XYZ" });
    expect("matricule" in sent).toBe(false);
    expect(sent).toEqual({ nom_complet: "AKE" });
  });
  it("confirme la création avec le matricule attribué", () => {
    expect(employeCreeMessage("EP-08")).toBe("Employé créé — matricule EP-08");
    expect(employeCreeMessage(null)).toBe("Employé créé");
  });
});
