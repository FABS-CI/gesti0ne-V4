import { describe, expect, it } from "vitest";

import { getRoutePermission } from "@/lib/route-permissions";

describe("route permission mapping", () => {
  it("uses action permissions for commercial create/edit routes instead of list permissions", () => {
    expect(getRoutePermission("/clients/nouveau")).toBe("clients.creer");
    expect(getRoutePermission("/clients/abc/modifier")).toBe("clients.modifier");
    expect(getRoutePermission("/commandes/nouvelle")).toBe("commandes.creer");
    expect(getRoutePermission("/paiements/nouveau")).toBe("paiements.creer");
  });

  it("maps logistics submodules to their own permissions", () => {
    expect(getRoutePermission("/clients/dashboard")).toBe("clients_dashboard.voir");
    expect(getRoutePermission("/colisage/responsables")).toBe("colisage_responsables.voir");
    expect(getRoutePermission("/livraison-suivi")).toBe("livraison_suivi.voir");
    expect(getRoutePermission("/stock/audit")).toBe("stock.voir_audit");
    expect(getRoutePermission("/alertes-stock")).toBe("alertes_stock.voir");
    expect(getRoutePermission("/livreurs")).toBe("livreurs.voir");
    expect(getRoutePermission("/dashboard-logistique")).toBe("dashboard_logistique.voir");
    expect(getRoutePermission("/rapports-logistique")).toBe("rapports_logistique.voir");
  });

  it("keeps dynamic detail routes on view permissions", () => {
    expect(getRoutePermission("/produits/123")).toBe("produits.voir");
    expect(getRoutePermission("/transferts/123")).toBe("transferts.voir");
    expect(getRoutePermission("/inventaires/123")).toBe("inventaires.voir");
  });

  it("requires create/edit permissions on sensitive child routes (audit fichier-56 §5)", () => {
    const cases: Array<[string, string]> = [
      ["/absences/nouveau", "absences.creer"],
      ["/absences/a1/modifier", "absences.modifier"],
      ["/conges/nouveau", "conges.creer"],
      ["/conges/a1/modifier", "conges.modifier"],
      ["/contrats/nouveau", "contrats.creer"],
      ["/contrats/a1/modifier", "contrats.modifier"],
      ["/employes/nouveau", "employes.creer"],
      ["/employes/a1/modifier", "employes.modifier"],
      ["/evaluations/nouveau", "evaluations.creer"],
      ["/evaluations/a1/modifier", "evaluations.modifier"],
      ["/fournisseurs/nouveau", "fournisseurs.creer"],
      ["/fournisseurs/a1/modifier", "fournisseurs.modifier"],
      ["/comptabilite/nouvelle", "comptabilite.creer"],
      ["/paie/nouveau", "paie.creer"],
      ["/fne-nouvelle", "fne.soumettre"],
      ["/parametres/zones-livraison", "parametres.modifier"],
      ["/utilisateurs/nouveau", "utilisateurs.creer"],
      ["/utilisateurs/a1/modifier", "utilisateurs.modifier"],
      ["/utilisateurs/production", "utilisateurs.modifier"],
    ];
    for (const [path, perm] of cases) expect(getRoutePermission(path), path).toBe(perm);
  });

  it("maps the real stock movements URL (not the file name stock_)", () => {
    expect(getRoutePermission("/stock/abc/mouvements")).toEqual(["stock.voir_mouvements", "stock.voir"]);
  });

  it("keeps list routes on view permissions", () => {
    expect(getRoutePermission("/conges")).toBe("conges.voir");
    expect(getRoutePermission("/fournisseurs/a1")).toBe("fournisseurs.voir");
  });
});
