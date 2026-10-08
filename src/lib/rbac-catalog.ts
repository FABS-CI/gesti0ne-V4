/**
 * Catalogue RBAC v2 — miroir TypeScript du seed SQL
 * (supabase/migrations/20260701162214_*.sql).
 *
 * Codes de permission : `${sous_module}.${action}` (ex : `commandes.voir`).
 * Le seed produit `sous_module × action` = ~57 sous-modules × 20 actions.
 * Cette source TS sert :
 *  - à la matrice d'admin (`/admin/roles-v3`) pour afficher les libellés
 *    et regrouper par module,
 *  - aux composants `<Can>` (autocomplétion des clés existantes).
 */

export type ActionCode =
  | "voir"
  | "creer"
  | "modifier"
  | "supprimer"
  | "valider"
  | "annuler"
  | "imprimer"
  | "telecharger"
  | "exporter_pdf"
  | "exporter_excel"
  | "importer"
  | "dupliquer"
  | "archiver"
  | "changer_statut"
  | "voir_prix"
  | "voir_couts"
  | "voir_marges"
  | "voir_ca"
  | "voir_stats"
  | "voir_historique"
  | "acceder_parametres";

export const ACTIONS: { code: ActionCode; libelle: string }[] = [
  { code: "voir", libelle: "Consulter" },
  { code: "creer", libelle: "Créer" },
  { code: "modifier", libelle: "Modifier" },
  { code: "supprimer", libelle: "Supprimer" },
  { code: "valider", libelle: "Valider" },
  { code: "annuler", libelle: "Annuler" },
  { code: "imprimer", libelle: "Imprimer" },
  { code: "telecharger", libelle: "Télécharger" },
  { code: "exporter_pdf", libelle: "Exporter PDF" },
  { code: "exporter_excel", libelle: "Exporter Excel" },
  { code: "importer", libelle: "Importer" },
  { code: "dupliquer", libelle: "Dupliquer" },
  { code: "archiver", libelle: "Archiver" },
  { code: "changer_statut", libelle: "Changer de statut" },
  { code: "voir_prix", libelle: "Voir les prix" },
  { code: "voir_couts", libelle: "Voir les coûts" },
  { code: "voir_marges", libelle: "Voir les marges" },
  { code: "voir_ca", libelle: "Voir le Chiffre d'Affaires" },
  { code: "voir_stats", libelle: "Voir les statistiques" },
  { code: "voir_historique", libelle: "Voir l'historique" },
  { code: "acceder_parametres", libelle: "Accéder aux paramètres" },
];

export type SousModule = {
  code: string;
  libelle: string;
};

export type ModuleGroup = {
  module: string;
  sousModules: SousModule[];
};

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    module: "Tableau de bord",
    sousModules: [
      { code: "dashboard", libelle: "Tableau de bord (global)" },
      { code: "dashboard_direction", libelle: "Tableau de bord — Direction" },
      { code: "dashboard_metier", libelle: "Tableau de bord — Métier" },
      { code: "dashboard_personnel", libelle: "Tableau de bord — Personnel" },
      { code: "mon_dashboard", libelle: "Mon tableau de bord" },
      { code: "dashboard_global", libelle: "Vue globale" },
    ],
  },
  {
    module: "Gestion commerciale",
    sousModules: [
      { code: "clients", libelle: "Clients" },
      { code: "clients_dashboard", libelle: "CRM & Analyses clients" },
      { code: "prospects", libelle: "Prospects" },
      { code: "tarifs", libelle: "Tarifs" },
      { code: "commandes", libelle: "Commandes" },
      { code: "proformas", libelle: "Proformas" },
      { code: "factures", libelle: "Factures" },
      { code: "paiements", libelle: "Paiements" },
      { code: "avoirs", libelle: "Avoirs" },
      { code: "retours", libelle: "Retours" },
      { code: "specimens", libelle: "Spécimens" },
    ],
  },
  {
    module: "Stocks & Logistique",
    sousModules: [
      { code: "produits", libelle: "Produits" },
      { code: "stock", libelle: "Stock" },
      { code: "alertes_stock", libelle: "Alertes de stock" },
      { code: "depots", libelle: "Dépôts" },
      { code: "transferts", libelle: "Transferts" },
      { code: "inventaires", libelle: "Inventaires" },
      { code: "incidents", libelle: "Incidents" },
      { code: "fournisseurs", libelle: "Fournisseurs" },
      { code: "achats", libelle: "Achats" },
      { code: "colisage", libelle: "Colisage" },
      { code: "flotte", libelle: "Flotte" },
      { code: "tournees", libelle: "Tournées" },
      { code: "livreurs", libelle: "Livreurs" },
      { code: "colisage_responsables", libelle: "Préparateurs & Responsables colisage" },
      { code: "livraison_suivi", libelle: "Suivi des livraisons" },
      { code: "bons_livraison", libelle: "Bons de livraison" },
      { code: "livraisons", libelle: "Livraisons" },
      { code: "expeditions", libelle: "Expéditions" },
      { code: "couts_logistiques", libelle: "Coûts logistiques" },
      { code: "dashboard_logistique", libelle: "Tableau de bord logistique" },
      { code: "rapports_logistique", libelle: "Rapports logistique" },
    ],
  },
  {
    module: "Finance",
    sousModules: [
      { code: "finances", libelle: "Finances" },
      { code: "tresorerie", libelle: "Trésorerie" },
      { code: "etat_compte_clients", libelle: "États compte clients" },
    ],
  },
  {
    module: "Comptabilité",
    sousModules: [
      { code: "compta_dashboard", libelle: "Tableau de bord Comptabilité" },
      { code: "comptabilite", libelle: "Comptabilité" },
      { code: "ecritures_comptables", libelle: "Écritures comptables" },
      { code: "plan_comptable", libelle: "Plan comptable" },
      { code: "balance", libelle: "Balance" },
      { code: "grand_livre", libelle: "Grand livre" },
      { code: "etats_comptables", libelle: "États comptables" },
      { code: "fec", libelle: "FEC" },
      { code: "fne", libelle: "FNE" },
      { code: "rapports_comptables", libelle: "Rapports comptables" },
    ],
  },
  {
    module: "Ressources humaines",
    sousModules: [
      { code: "employes", libelle: "Employés" },
      { code: "departements", libelle: "Départements" },
      { code: "fonctions", libelle: "Fonctions" },
      { code: "contrats", libelle: "Contrats" },
      { code: "conges", libelle: "Congés" },
      { code: "absences", libelle: "Absences" },
      { code: "missions", libelle: "Missions" },
      { code: "evaluations", libelle: "Évaluations" },
    ],
  },
  {
    module: "Paie",
    sousModules: [
      { code: "paie", libelle: "Paie" },
      { code: "bulletins", libelle: "Bulletins de paie" },
      { code: "paie_parametres", libelle: "Paramètres de paie" },
      { code: "paie_rubriques", libelle: "Rubriques de paie" },
    ],
  },
  {
    module: "Notifications",
    sousModules: [
      { code: "notifications", libelle: "Notifications" },
      { code: "historique_envois", libelle: "Historique des envois" },
    ],
  },
  {
    module: "Rapports",
    sousModules: [
      { code: "rapports", libelle: "Rapports" },
      { code: "exports", libelle: "Exports" },
      { code: "bi_analytics", libelle: "BI Analytics" },
    ],
  },
  {
    module: "Administration",
    sousModules: [
      { code: "utilisateurs", libelle: "Utilisateurs" },
      { code: "roles_permissions", libelle: "Rôles & Permissions" },
      { code: "audit", libelle: "Audit" },
      { code: "exercices", libelle: "Exercices" },
      { code: "parametres", libelle: "Paramètres" },
      { code: "backup", libelle: "Sauvegardes" },
      { code: "documents", libelle: "Documents" },
      { code: "centre_documents", libelle: "Centre de documents" },
      { code: "modeles_documents", libelle: "Modèles de documents" },
      { code: "workflows", libelle: "Workflows" },
      { code: "integrations", libelle: "Intégrations" },
      { code: "profil", libelle: "Mon profil" },
    ],
  },
];

export function permissionCode(sousModule: string, action: ActionCode): string {
  return `${sousModule}.${action}`;
}

export function flattenPermissions(): string[] {
  const out: string[] = [];
  for (const g of MODULE_GROUPS) {
    for (const sm of g.sousModules) {
      for (const a of ACTIONS) out.push(permissionCode(sm.code, a.code));
    }
  }
  for (const p of EXTRA_PERMISSIONS) out.push(p.code);
  return out;
}

// ─────────────────────────────────────────────────────────────
// EXTRA_PERMISSIONS — actions métier spécifiques hors produit cartésien
// Chaque entrée provient de l'audit `docs/RBAC-CATALOGUE-CIBLE.md`.
// Ajout-only : ne pas retirer sans purge SQL correspondante.
// ─────────────────────────────────────────────────────────────

export type PermissionCategorie =
  | "workflow"      // valider/rejeter/convertir/soumettre/clôturer…
  | "sensible"      // voir_ca / voir_couts / voir_marges / voir_prix
  | "administration"// gestion users/roles/paramètres système
  | "declaration"   // CNPS / FDFP / ITS / FNE / FEC
  | "export"        // impressions/exports spécifiques
  | "consultation"; // voir_historique / voir_audit

export type ExtraPermission = {
  code: string;
  libelle: string;
  sousModule: string;
  categorie: PermissionCategorie;
};

export const EXTRA_PERMISSIONS: ExtraPermission[] = [
  // ── Gestion commerciale ────────────────────────────────────
  { code: "clients.bloquer", libelle: "Bloquer/débloquer un client", sousModule: "clients", categorie: "workflow" },
  { code: "commandes.soumettre", libelle: "Soumettre une commande pour validation", sousModule: "commandes", categorie: "workflow" },
  { code: "commandes.generer_proforma", libelle: "Générer une proforma depuis une commande", sousModule: "commandes", categorie: "workflow" },
  { code: "commandes.convertir_en_bl", libelle: "Convertir une commande en bon de livraison", sousModule: "commandes", categorie: "workflow" },
  { code: "commandes.generer_facture", libelle: "Générer une facture depuis une commande", sousModule: "commandes", categorie: "workflow" },
  { code: "commandes.telecharger_pdf", libelle: "Télécharger le PDF d'une commande", sousModule: "commandes", categorie: "export" },
  { code: "proformas.convertir_en_commande", libelle: "Convertir une proforma en commande", sousModule: "proformas", categorie: "workflow" },
  { code: "proformas.telecharger_pdf", libelle: "Télécharger le PDF d'une proforma", sousModule: "proformas", categorie: "export" },
  { code: "factures.soumettre_fne", libelle: "Soumettre une facture au FNE", sousModule: "factures", categorie: "declaration" },
  { code: "bons_livraison.telecharger_pdf", libelle: "Télécharger le PDF d'un BL", sousModule: "bons_livraison", categorie: "export" },
  { code: "colisage.deverrouiller", libelle: "Déverrouiller un colisage", sousModule: "colisage", categorie: "workflow" },
  { code: "colisage.imprimer_etiquettes", libelle: "Imprimer les étiquettes de colis", sousModule: "colisage", categorie: "export" },
  { code: "etat_compte_clients.recalculer", libelle: "Recalculer le solde d'un client", sousModule: "etat_compte_clients", categorie: "workflow" },

  // ── Stocks & Logistique ────────────────────────────────────
  { code: "stock.creer_mouvement", libelle: "Créer un mouvement de stock manuel", sousModule: "stock", categorie: "workflow" },
  { code: "stock.recalculer", libelle: "Recalculer le stock (global ou produit)", sousModule: "stock", categorie: "administration" },
  { code: "stock.voir_audit", libelle: "Voir l'audit du stock", sousModule: "stock", categorie: "consultation" },
  { code: "stock.voir_mouvements", libelle: "Voir les mouvements d'un produit", sousModule: "stock", categorie: "consultation" },
  { code: "depots.definir_principal", libelle: "Définir le dépôt principal", sousModule: "depots", categorie: "administration" },
  { code: "transferts.executer", libelle: "Exécuter un transfert", sousModule: "transferts", categorie: "workflow" },
  { code: "transferts.receptionner", libelle: "Réceptionner un transfert", sousModule: "transferts", categorie: "workflow" },
  { code: "transferts.telecharger_pdf", libelle: "Télécharger le PDF d'un transfert", sousModule: "transferts", categorie: "export" },
  { code: "inventaires.regulariser", libelle: "Régulariser un inventaire", sousModule: "inventaires", categorie: "workflow" },
  { code: "achats.receptionner", libelle: "Réceptionner un achat", sousModule: "achats", categorie: "workflow" },
  { code: "achats.payer", libelle: "Payer un achat", sousModule: "achats", categorie: "workflow" },
  { code: "tournees.cloturer", libelle: "Clôturer une tournée", sousModule: "tournees", categorie: "workflow" },
  { code: "tournees.valider_couts", libelle: "Valider les coûts d'une tournée", sousModule: "tournees", categorie: "workflow" },
  { code: "tournees.refuser_couts", libelle: "Refuser les coûts d'une tournée", sousModule: "tournees", categorie: "workflow" },
  { code: "tournees.annuler_validation", libelle: "Annuler la validation d'une tournée", sousModule: "tournees", categorie: "workflow" },
  { code: "livraisons.avancer_etape", libelle: "Faire avancer une étape de livraison", sousModule: "livraisons", categorie: "workflow" },
  { code: "livraisons.avancer_masse", libelle: "Faire avancer les livraisons en masse", sousModule: "livraisons", categorie: "workflow" },
  { code: "livraisons.valider_remise", libelle: "Valider une remise de livraison", sousModule: "livraisons", categorie: "workflow" },

  // ── Finances ───────────────────────────────────────────────
  { code: "paiements.rejeter", libelle: "Rejeter un paiement", sousModule: "paiements", categorie: "workflow" },
  { code: "paiements.imprimer_recu", libelle: "Imprimer un reçu de paiement", sousModule: "paiements", categorie: "export" },
  { code: "paiements.voir_historique_annulations", libelle: "Voir l'historique des annulations de paiements", sousModule: "paiements", categorie: "consultation" },

  // ── Comptabilité / FEC / Exercices ─────────────────────────
  { code: "fec.generer", libelle: "Générer le fichier FEC", sousModule: "fec", categorie: "declaration" },
  { code: "exercices.cloturer", libelle: "Clôturer un exercice comptable", sousModule: "exercices", categorie: "workflow" },

  // ── FNE ────────────────────────────────────────────────────
  { code: "fne.soumettre", libelle: "Soumettre une facture au FNE", sousModule: "fne", categorie: "declaration" },
  { code: "fne.reessayer", libelle: "Réessayer un envoi FNE", sousModule: "fne", categorie: "declaration" },
  { code: "fne.rembourser", libelle: "Rembourser via le FNE", sousModule: "fne", categorie: "declaration" },
  { code: "fne.telecharger_json", libelle: "Télécharger le JSON FNE", sousModule: "fne", categorie: "export" },
  { code: "fne.modifier_parametres", libelle: "Modifier les paramètres FNE", sousModule: "fne", categorie: "administration" },

  // ── Ressources Humaines ────────────────────────────────────
  { code: "employes.restaurer", libelle: "Restaurer un employé archivé", sousModule: "employes", categorie: "workflow" },
  { code: "employes.renumeroter", libelle: "Renuméroter les matricules employés", sousModule: "employes", categorie: "administration" },
  { code: "employes.imprimer_fiche", libelle: "Imprimer la fiche employé", sousModule: "employes", categorie: "export" },
  { code: "employes.creer_compte", libelle: "Créer un compte utilisateur pour un employé", sousModule: "employes", categorie: "administration" },
  { code: "conges.approuver", libelle: "Approuver un congé", sousModule: "conges", categorie: "workflow" },
  { code: "conges.rejeter", libelle: "Rejeter un congé", sousModule: "conges", categorie: "workflow" },

  // ── Paie ───────────────────────────────────────────────────
  { code: "paie.creer_bulletin", libelle: "Créer un bulletin de paie", sousModule: "paie", categorie: "workflow" },
  { code: "paie.modifier_bulletin", libelle: "Modifier un bulletin de paie", sousModule: "paie", categorie: "workflow" },
  { code: "paie.supprimer_bulletin", libelle: "Supprimer un bulletin de paie", sousModule: "paie", categorie: "workflow" },
  { code: "paie.imprimer_bulletin", libelle: "Imprimer un bulletin de paie", sousModule: "paie", categorie: "export" },
  { code: "paie.declarer_cnps", libelle: "Déclarer la CNPS", sousModule: "paie", categorie: "declaration" },
  { code: "paie.declarer_fdfp", libelle: "Déclarer le FDFP", sousModule: "paie", categorie: "declaration" },
  { code: "paie.declarer_its", libelle: "Déclarer l'ITS", sousModule: "paie", categorie: "declaration" },
  { code: "paie.telecharger_declaration", libelle: "Télécharger une déclaration paie", sousModule: "paie", categorie: "export" },

  // ── Notifications ──────────────────────────────────────────
  { code: "notifications.marquer_lue", libelle: "Marquer une notification comme lue", sousModule: "notifications", categorie: "workflow" },
  { code: "notifications.purger", libelle: "Purger les notifications", sousModule: "notifications", categorie: "administration" },
  { code: "notifications.generer", libelle: "Générer des notifications", sousModule: "notifications", categorie: "administration" },
  { code: "notifications.exporter_historique", libelle: "Exporter l'historique des envois", sousModule: "historique_envois", categorie: "export" },

  // ── Sauvegardes ────────────────────────────────────────────
  { code: "backup.exporter_csv", libelle: "Exporter une sauvegarde en CSV", sousModule: "backup", categorie: "export" },
  { code: "backup.planifier", libelle: "Planifier une sauvegarde", sousModule: "backup", categorie: "administration" },
  { code: "backup.restaurer", libelle: "Restaurer une sauvegarde", sousModule: "backup", categorie: "administration" },

  // ── Administration — Utilisateurs ──────────────────────────
  { code: "utilisateurs.activer_desactiver", libelle: "Activer / désactiver un utilisateur", sousModule: "utilisateurs", categorie: "administration" },
  { code: "utilisateurs.assigner_role", libelle: "Assigner un rôle à un utilisateur", sousModule: "utilisateurs", categorie: "administration" },
  { code: "utilisateurs.revoquer_role", libelle: "Révoquer un rôle d'un utilisateur", sousModule: "utilisateurs", categorie: "administration" },
  { code: "utilisateurs.reset_mfa", libelle: "Réinitialiser le MFA d'un utilisateur", sousModule: "utilisateurs", categorie: "administration" },
  { code: "utilisateurs.revoquer_mfa", libelle: "Révoquer le MFA d'un utilisateur", sousModule: "utilisateurs", categorie: "administration" },

  // ── Rôles & Permissions ────────────────────────────────────
  { code: "roles_permissions.creer_role", libelle: "Créer un rôle", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.modifier_role", libelle: "Modifier un rôle", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.supprimer_role", libelle: "Supprimer un rôle", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.dupliquer_role", libelle: "Dupliquer un rôle", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.assigner_permission", libelle: "Modifier les permissions d'un rôle", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.assigner_role_utilisateur", libelle: "Assigner un rôle à un utilisateur", sousModule: "roles_permissions", categorie: "administration" },
  { code: "roles_permissions.voir_audit", libelle: "Voir l'audit RBAC", sousModule: "roles_permissions", categorie: "consultation" },

  // ── Paramètres / Audit ─────────────────────────────────────
  { code: "audit.recalculer_soldes", libelle: "Recalculer les soldes clients globaux", sousModule: "audit", categorie: "administration" },

  // ── Tableau de bord (extras métier) ─────────────────────────
  { code: "dashboard.voir_alertes",   libelle: "Voir les alertes",        sousModule: "dashboard", categorie: "consultation" },
  { code: "dashboard.voir_objectifs", libelle: "Voir les objectifs",      sousModule: "dashboard", categorie: "consultation" },
  { code: "dashboard.voir_widgets",   libelle: "Voir les widgets",        sousModule: "dashboard", categorie: "consultation" },
  { code: "dashboard.personnaliser",  libelle: "Personnaliser le tableau de bord", sousModule: "dashboard", categorie: "administration" },
  { code: "dashboard.voir_ventes",    libelle: "Voir les ventes",         sousModule: "dashboard", categorie: "sensible" },
  { code: "dashboard.voir_achats",    libelle: "Voir les achats",         sousModule: "dashboard", categorie: "sensible" },
  { code: "dashboard.voir_paiements", libelle: "Voir les paiements",      sousModule: "dashboard", categorie: "sensible" },
  { code: "dashboard.voir_creances",  libelle: "Voir les créances",       sousModule: "dashboard", categorie: "sensible" },
  { code: "dashboard.voir_depenses",  libelle: "Voir les dépenses",       sousModule: "dashboard", categorie: "sensible" },

  // ── Prospects (extras métier) ───────────────────────────────
  { code: "prospects.convertir_client", libelle: "Convertir un prospect en client", sousModule: "prospects", categorie: "workflow" },
  { code: "prospects.voir_contact",     libelle: "Voir les contacts du prospect",   sousModule: "prospects", categorie: "consultation" },
];

/** Retourne la définition étendue si le code est une permission métier. */
export function findExtraPermission(code: string): ExtraPermission | undefined {
  return EXTRA_PERMISSIONS.find((p) => p.code === code);
}
