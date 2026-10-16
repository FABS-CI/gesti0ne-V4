/**
 * Pont RBAC v3 → codes de permission historiques utilisés par l'UI.
 *
 * Le moteur de sécurité en base (policies RLS + `rbac3_can`) travaille avec des
 * codes `<module>.<action>` (24 modules × 8 actions). Les gardes UI (`<Can>`,
 * `RouteGuard`, `ROUTE_TO_PERMISSION`) utilisent encore les codes fins
 * `<sous_module>.<action>` du catalogue v2.
 *
 * Ce module traduit les permissions v3 d'un utilisateur en codes v2 afin que
 * l'interface affiche exactement ce que la base autorise réellement.
 */

/** Sous-modules UI rattachés à chaque module du moteur v3. */
export const RBAC3_MODULE_TO_SOUS_MODULES: Record<string, string[]> = {
  tableau_bord: [
    "dashboard",
    "dashboard_direction",
    "dashboard_metier",
    "dashboard_personnel",
    "mon_dashboard",
    "dashboard_global",
  ],
  clients: ["clients", "clients_dashboard", "prospects", "tarifs", "etat_compte_clients"],
  commandes: ["commandes"],
  devis: ["proformas"],
  factures: ["factures", "avoirs"],
  paiements: ["paiements"],
  retours: ["retours", "specimens"],
  ventes: ["commandes", "proformas", "factures", "specimens"],
  produits: ["produits", "alertes_stock"],
  catalogue: ["produits", "tarifs"],
  stocks: ["stock", "alertes_stock", "transferts", "incidents"],
  depots: ["depots", "transferts"],
  inventaires: ["inventaires"],
  achats: ["achats", "approvisionnements"],
  fournisseurs: ["fournisseurs"],
  logistique: [
    "colisage",
    "colisage_responsables",
    "flotte",
    "tournees",
    "livreurs",
    "livraison_suivi",
    "bons_livraison",
    "livraisons",
    "expeditions",
    "couts_logistiques",
    "dashboard_logistique",
    "rapports_logistique",
  ],
  comptabilite: [
    "compta_dashboard",
    "comptabilite",
    "ecritures_comptables",
    "plan_comptable",
    "balance",
    "grand_livre",
    "etats_comptables",
    "fec",
    "fne",
    "rapports_comptables",
    "exercices",
  ],
  banque: ["finances", "tresorerie"],
  caisse: ["finances", "tresorerie"],
  rh: [
    "employes",
    "departements",
    "fonctions",
    "contrats",
    "conges",
    "absences",
    "missions",
    "evaluations",
    "paie",
    "bulletins",
    "paie_parametres",
    "paie_rubriques",
  ],
  rapports: ["rapports", "exports", "bi_analytics"],
  audit: ["audit"],
  administration: [
    "utilisateurs",
    "roles_permissions",
    "backup",
    "documents",
    "centre_documents",
    "modeles_documents",
    "workflows",
    "integrations",
  ],
  parametres: [
    "parametres",
    "exercices",
    "modeles_documents",
    "historique_envois",
    "configurations",
  ],
};

/** Actions UI (catalogue v2) couvertes par chaque action du moteur v3. */
export const RBAC3_ACTION_TO_ACTIONS: Record<string, string[]> = {
  lire: ["voir", "voir_historique", "voir_stats"],
  creer: ["creer", "dupliquer", "importer"],
  modifier: ["modifier", "changer_statut"],
  supprimer: ["supprimer", "archiver"],
  valider: ["valider"],
  annuler: ["annuler"],
  imprimer: ["imprimer", "telecharger"],
  exporter: ["exporter_pdf", "exporter_excel", "telecharger"],
  noter: ["noter"],
};

/**
 * Convertit une liste de permissions v3 (`module.action`) en l'ensemble des
 * codes UI correspondants. Les codes v3 d'origine sont conservés pour les
 * appelants déjà migrés.
 */
export function expandRbac3Permissions(codes: Iterable<string>): Set<string> {
  const out = new Set<string>();

  for (const code of codes) {
    out.add(code);
    const idx = code.indexOf(".");
    if (idx <= 0) continue;

    const moduleCode = code.slice(0, idx);
    const actionCode = code.slice(idx + 1);
    const sousModules = RBAC3_MODULE_TO_SOUS_MODULES[moduleCode];
    const actions = RBAC3_ACTION_TO_ACTIONS[actionCode];
    if (!sousModules || !actions) continue;

    for (const sousModule of sousModules) {
      for (const action of actions) out.add(`${sousModule}.${action}`);
      // Toute action accordée implique la consultation du sous-module.
      out.add(`${sousModule}.voir`);
    }
  }

  // Accès aux écrans de paramétrage lorsque le module parametres est lisible.
  if (out.has("parametres.voir")) out.add("parametres.acceder_parametres");
  // Profil personnel : toujours accessible à un utilisateur authentifié.
  out.add("profil.voir");
  out.add("notifications.voir");

  return out;
}
