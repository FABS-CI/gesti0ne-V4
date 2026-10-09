import { describe, it, expect } from "vitest";
import { pickLandingRoute } from "../dashboard-landing";

describe("page d'accueil après connexion", () => {
  it("super admin atterrit sur /dashboard (Vue globale supprimée)", () => {
    expect(pickLandingRoute([], true)).toBe("/dashboard");
  });
  it("droit direction atterrit sur /dashboard", () => {
    expect(pickLandingRoute(["dashboard_direction.voir"])).toBe("/dashboard");
  });
  it("logisticien garde son tableau logistique", () => {
    expect(pickLandingRoute(["dashboard_logistique.voir"])).toBe("/dashboard-logistique");
  });
});
