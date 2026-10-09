/**
 * Mapping route TanStack Router → permission RBAC v2 requise pour l'accéder.
 *
 * - `null` = route toujours accessible à tout utilisateur authentifié
 *   (profil, notifications personnelles, etc.).
 * - Route absente du map → accès **refusé** (fallback strict, batch P1).
 *   Toute nouvelle route doit être déclarée ici explicitement.
 *
 * Utilisé par :
 *  - `<RouteGuard />` dans `_authenticated/route.tsx` (garde de route)
 *  - `AppSidebar` (filtrage du menu par permission)
 */
export type RoutePermissionRequirement = string | string[] | null;

/**
 * Note (fix RBAC) : pour les tableaux de bord, plusieurs sous-modules
 * représentent la même surface UI (`dashboard`, `dashboard_personnel`,
 * `mon_dashboard`, …). On accepte n'importe lequel d'entre eux (`any of`)
 * afin que la matrice reflète le comportement attendu : cocher un des
 * sous-modules « Tableau de bord » suffit à débloquer la page.
 */
export const ROUTE_TO_PERMISSION: Record<string, RoutePermissionRequirement> = {
  // Accès libre à tout utilisateur authentifié : le tableau de bord principal
  // et « Mon tableau de bord » sont considérés comme des pages d'accueil.
  "/dashboard": null,
  // Centre de pilotage : chaque bloc est filtré côté serveur par permission.
  "/pilotage": null,
  "/rapports": "rapports.voir",

  "/clients": "clients.voir",
  "/clients/nouveau": "clients.creer",
  "/clients/$clientId": "clients.voir",
  "/clients/$clientId/modifier": "clients.modifier",
  "/clients/dashboard": "clients_dashboard.voir",
  "/commandes": "commandes.voir",
  "/commandes/nouvelle": "commandes.creer",
  "/commandes/$commandeId": "commandes.voir",
  "/commandes/$commandeId/modifier": "commandes.modifier",
  "/proformas": "proformas.voir",
  "/proformas/$proformaId": "proformas.voir",
  "/factures": "factures.voir",
  "/factures/$factureId": "factures.voir",
  "/bons-livraison": "bons_livraison.voir",
  "/colisage": "colisage.voir",
  "/colisage/$blId": "colisage.voir",
  "/colisage/responsables": "colisage_responsables.voir",
  "/livraison-suivi": "livraison_suivi.voir",
  "/livraison-suivi/$commandeRef": "livraison_suivi.voir",
  "/livraison-suivi/$commandeRef/remise": "livraison_suivi.modifier",
  "/livraison-suivi/tournees": "tournees.voir",
  "/livraison-suivi/tournees/$tourneeId": "tournees.voir",
  "/paiements": "paiements.voir",
  "/paiements/nouveau": "paiements.creer",
  "/paiements/$paiementId": "paiements.voir",
  "/retours": "retours.voir",
  "/retours/nouveau": "retours.creer",
  "/retours/$retourId": "retours.voir",
  "/specimens": "specimens.voir",
  "/specimens/nouveau": "specimens.creer",
  "/specimens/$specimenId": "specimens.voir",
  "/expeditions": "expeditions.voir",
  "/catalogue-integrite": "produits.voir",

  "/produits": "produits.voir",
  "/produits/$produitId": "produits.voir",
  "/depots": "depots.voir",
  "/achats": "achats.voir",
  "/achats/nouveau": "achats.creer",
  "/achats/$achatId": "achats.voir",
  "/stock": "stock.voir",
  "/stock/$produitId/mouvements": ["stock.voir_mouvements", "stock.voir"],
  "/stock/audit": "stock.voir_audit",
  "/alertes-stock": "alertes_stock.voir",
  "/inventaires": "inventaires.voir",
  "/inventaires/nouveau-physique": "inventaires.creer",
  "/inventaires/$inventaireId": "inventaires.voir",
  "/incidents": "incidents.voir",
  "/incidents/nouveau": "incidents.creer",
  "/incidents/$incidentId": "incidents.voir",
  "/fournisseurs": "fournisseurs.voir",
  "/fournisseurs/$fournisseurId": "fournisseurs.voir",
  "/fournisseurs/nouveau": "fournisseurs.creer",
  "/fournisseurs/$fournisseurId/modifier": "fournisseurs.modifier",
  "/transferts": "transferts.voir",
  "/transferts/nouveau": "transferts.creer",
  "/transferts/$transfertId": "transferts.voir",
  "/fleet": "flotte.voir",
  "/livreurs": "livreurs.voir",
  "/logistics-costs": "couts_logistiques.voir",
  "/tournees": "tournees.voir",
  "/tournees/nouvelle": "tournees.creer",
  "/tournees/$tourneeId": "tournees.voir",
  "/tournees-bl": "tournees.voir",
  "/tournees-bl/$tourneeId": "tournees.voir",
  "/bon-de-sortie": "tournees.voir",
  "/bon-de-sortie/$tourneeId": "tournees.voir",
  "/bon-de-tournee": "tournees.voir",
  "/bon-de-tournee/$tourneeId": "tournees.voir",
  "/dashboard-logistique": "dashboard_logistique.voir",
  "/rapports-logistique": "rapports_logistique.voir",

  "/finances": "finances.voir",
  "/fne": "fne.voir",
  "/fne-nouvelle": "fne.creer",
  "/fne-detail": "fne.voir",
  "/fne-logs": "fne.voir",
  "/fne-settings": "fne.acceder_parametres",
  "/etat-compte-clients": "etat_compte_clients.voir",

  "/compta-dashboard": ["compta_dashboard.voir", "comptabilite.voir", "dashboard.voir"],
  "/comptabilite": "comptabilite.voir",
  "/comptabilite/nouvelle": "comptabilite.creer",
  "/ecritures-comptables": "ecritures_comptables.voir",
  "/plan-comptable": "plan_comptable.voir",
  "/balance": "balance.voir",
  "/grand-livre": "grand_livre.voir",
  "/etats-comptables": "etats_comptables.voir",
  "/comptabilite/fec": "fec.voir",
  "/rapports-comptables": ["rapports_comptables.voir", "rapports.voir"],

  "/rh-dashboard": ["dashboard_metier.voir", "dashboard.voir"],
  "/employes": "employes.voir",
  "/employes/nouveau": "employes.creer",
  "/employes/$employeId/modifier": "employes.modifier",
  "/departements": "departements.voir",
  "/fonctions": "fonctions.voir",
  "/contrats": "contrats.voir",
  "/contrats/nouveau": "contrats.creer",
  "/contrats/$contratId/modifier": "contrats.modifier",
  "/conges": "conges.voir",
  "/conges/nouveau": "conges.creer",
  "/conges/$congeId/modifier": "conges.modifier",
  "/absences": "absences.voir",
  "/absences/nouveau": "absences.creer",
  "/absences/$absenceId/modifier": "absences.modifier",
  "/missions": "missions.voir",
  "/evaluations": "evaluations.voir",
  "/evaluations/nouveau": "evaluations.creer",
  "/evaluations/$evaluationId/modifier": "evaluations.modifier",

  "/paie-dashboard": ["paie.voir", "dashboard.voir"],
  "/paie": "paie.voir",
  "/paie/nouveau": "paie.creer",
  "/paie-parametres": ["paie_parametres.voir", "paie.acceder_parametres"],
  "/paie-rubriques": ["paie_rubriques.voir", "paie.voir"],
  "/paie-declarations": "paie.voir",
  "/paie-historique": "paie.voir_historique",
  "/paie-generation": "paie.creer",
  "/paie-exports": "paie.exporter_pdf",
  "/paie-rapports": "rapports.voir",

  "/notifications": null,
  "/acces-refuse": null,
  "/historique-envois": ["historique_envois.voir", "notifications.voir_historique"],

  "/file-storage": "documents.voir",
  "/backup": "backup.voir",
  "/utilisateurs": "utilisateurs.voir",
  "/utilisateurs/nouveau": "utilisateurs.creer",
  "/utilisateurs/$userId/modifier": "utilisateurs.modifier",
  "/utilisateurs/production": "utilisateurs.modifier",
  "/import-donnees": "parametres.importer",
  "/exports": "exports.voir",
  "/audit": "audit.voir",
  "/admin/slo": "audit.voir",
  "/admin/data-quality": "audit.voir",
  "/profil": null,
  "/documentation": null,
  "/parametres": "parametres.voir",
  "/parametres/zones-livraison": "parametres.modifier",
  "/centre-documents": ["centre_documents.voir", "documents.voir"],
  "/modeles-documents": "modeles_documents.voir",
  "/documents-impression": "documents.voir",
  "/approbations": "workflows.voir",
  "/workflow-approvals": "workflows.voir",
  "/workflows-definitions": "workflows.acceder_parametres",

  // Admin & exercices (P2)
  "/admin/audit-paiements": "audit.voir",
  "/admin/perf": "audit.voir",
  "/exercices": ["exercices.voir", "parametres.voir"],

  // Lot F — mappings manquants détectés par l'audit Lot E
  "/admin/google-drive": "integrations.acceder_parametres",
  "/admin/securite": "audit.voir",
  "/admin/rpc-errors": "audit.voir",
  "/admin/approbation-seuils": "workflows.acceder_parametres",
  "/admin/roles-v3": "roles_permissions.voir",
  "/admin/sante-systeme": "audit.voir",
  "/admin/web-vitals": "audit.voir",
  "/conges-en-cours": "conges.voir",

};

/**
 * Retourne la permission requise pour un chemin donné.
 * - `undefined` : route non mappée (accès refusé côté RouteGuard depuis P1).
 * - `null` : route explicitement libre pour tout utilisateur authentifié.
 * - `string` : code permission `sous_module.action` à vérifier.
 */
export function getRoutePermission(pathname: string): RoutePermissionRequirement | undefined {
  // exact match d'abord
  if (pathname in ROUTE_TO_PERMISSION) return ROUTE_TO_PERMISSION[pathname];

  // Puis routes dynamiques TanStack (`$id`) : /commandes/$commandeId/modifier
  // doit matcher /commandes/<uuid>/modifier avant le fallback par préfixe
  // /commandes, sinon la page de modification ne demanderait que `.voir`.
  let bestDynamic: string | undefined;
  for (const key of Object.keys(ROUTE_TO_PERMISSION)) {
    if (!key.includes("$")) continue;
    if (matchesDynamicRoute(key, pathname)) {
      if (!bestDynamic || key.length > bestDynamic.length) bestDynamic = key;
    }
  }
  if (bestDynamic) return ROUTE_TO_PERMISSION[bestDynamic];

  // sinon longest-prefix match (routes détail : /clients/:id → /clients)
  let best: string | undefined;
  for (const key of Object.keys(ROUTE_TO_PERMISSION)) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      if (!best || key.length > best.length) best = key;
    }
  }
  return best ? ROUTE_TO_PERMISSION[best] : undefined;
}

function matchesDynamicRoute(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith("$") || part === pathParts[index]);
}

/**
 * Préfixes de routes réservés exclusivement au Super Administrateur.
 * Ces routes composent le groupe "Administration" et ne sont accessibles
 * ni par URL directe, ni via le menu, pour tout autre rôle — même si
 * la matrice RBAC leur accordait la permission correspondante.
 */
export const SUPER_ADMIN_ONLY_ROUTES: readonly string[] = [
  "/utilisateurs",
  "/audit",
  "/backup",
  "/admin",
];

export function isSuperAdminOnlyRoute(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}
