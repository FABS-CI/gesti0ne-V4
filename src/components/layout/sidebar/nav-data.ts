export type Item = {
  title: string;
  url: string;
  ready?: boolean;
  /**
   * Nom du sous-dossier (section repliable) affiché dans le menu.
   * Uniquement visuel : n'affecte ni le routage, ni le RBAC, ni les URLs.
   */
  section?: string;
  /** Si défini, affiche un badge dynamique piloté par ce hook. */
  badge?: never;
};
export type Group = {
  label: string;
  color: string;
  light: string;
  grad: string;
  shadow: string;
  activeText?: string;
  /**
   * Si `true`, ce groupe (et toutes ses routes) n'est visible et
   * accessible que par le Super Administrateur. Utilisé pour verrouiller
   * strictement le groupe Administration.
   */
  superAdminOnly?: boolean;
  items: Item[];
};

export const groups: Group[] = [
  {
    label: "Tableau de bord",
    color: "#3B82F6",
    light: "rgba(59,130,246,0.12)",
    grad: "linear-gradient(90deg,#3B82F6,#60A5FA)",
    shadow: "rgba(59,130,246,0.3)",
    items: [
      { title: "Tableau de bord", url: "/dashboard", ready: true },
      { title: "Centre de pilotage", url: "/pilotage", ready: true },
      { title: "Rapports", url: "/rapports", ready: true },
      { title: "Analyse des ventes", url: "/rapports/analyse", ready: true },
      { title: "Frais de transport", url: "/rapports/transport", ready: true },
    ],
  },
  {
    label: "Gestion commerciale",
    color: "#F97316",
    light: "rgba(249,115,22,0.12)",
    grad: "linear-gradient(90deg,#F97316,#FB923C)",
    shadow: "rgba(249,115,22,0.3)",
    items: [
      { title: "Clients", url: "/clients", ready: true },
      { title: "CRM & Analyses", url: "/clients/dashboard", ready: true },
      { title: "Commandes", url: "/commandes", ready: true },
      { title: "Proformas", url: "/proformas", ready: true },
      { title: "Factures", url: "/factures", ready: true },
      { title: "Paiements", url: "/paiements", ready: true },
      { title: "Retours", url: "/retours", ready: true },
      { title: "Spécimens", url: "/specimens", ready: true },
    ],
  },
  {
    label: "Stocks & Logistique",
    color: "#10B981",
    light: "rgba(16,185,129,0.12)",
    grad: "linear-gradient(90deg,#10B981,#34D399)",
    shadow: "rgba(16,185,129,0.3)",
    items: [
      // Catalogue — Données de référence
      { title: "Produits", url: "/produits", ready: true, section: "Catalogue" },
      { title: "Dépôts", url: "/depots", ready: true, section: "Catalogue" },
      {
        title: "Fournisseurs",
        url: "/fournisseurs",
        ready: true,
        section: "Catalogue",
      },

      // Réception — Entrées de marchandises
      {
        title: "Approvisionnements",
        url: "/achats",
        ready: true,
        section: "Réception",
      },
      { title: "Mouvements", url: "/stock", ready: true, section: "Réception" },

      // Stock — Gestion et contrôle des stocks
      { title: "Transferts", url: "/transferts", ready: true, section: "Stock" },
      {
        title: "Inventaires",
        url: "/inventaires",
        ready: true,
        section: "Stock",
      },
      {
        title: "Alertes de Stock",
        url: "/alertes-stock",
        ready: true,
        section: "Stock",
      },
      {
        title: "Incidents de Stock",
        url: "/incidents",
        ready: true,
        section: "Stock",
      },
      {
        title: "Audit stock",
        url: "/stock/audit",
        ready: true,
        section: "Stock",
      },

      // Préparation — Préparation des commandes
      { title: "Colisage", url: "/colisage", ready: true, section: "Préparation" },
      {
        title: "Préparateurs / Responsables colisage",
        url: "/colisage/responsables",
        ready: true,
        section: "Préparation",
      },
      {
        title: "Bons de livraison",
        url: "/bons-livraison",
        ready: true,
        section: "Préparation",
      },

      // Livraison — Transport et suivi
      { title: "Livreurs", url: "/livreurs", ready: true, section: "Livraison" },
      { title: "Flotte", url: "/fleet", ready: true, section: "Livraison" },
      { title: "Tournées", url: "/tournees", ready: true, section: "Livraison" },
      {
        title: "Suivi des livraisons",
        url: "/livraison-suivi",
        ready: true,
        section: "Livraison",
      },

      // Analyse — Indicateurs et rapports
      {
        title: "Dashboard logistique",
        url: "/dashboard-logistique",
        ready: true,
        section: "Analyse",
      },
      {
        title: "Rapports logistique",
        url: "/rapports-logistique",
        ready: true,
        section: "Analyse",
      },
    ],
  },
  {
    label: "Finances",
    color: "#EAB308",
    light: "rgba(234,179,8,0.18)",
    grad: "linear-gradient(90deg,#EAB308,#FACC15)",
    shadow: "rgba(234,179,8,0.35)",
    activeText: "#111827",
    items: [
      { title: "Tableau de bord Financier", url: "/finances", ready: true },
      { title: "FNE", url: "/fne", ready: true },
      {
        title: "États de compte clients",
        url: "/etat-compte-clients",
        ready: true,
      },
      {
        title: "Coûts logistiques",
        url: "/logistics-costs",
        ready: true,
      },
    ],
  },
  {
    label: "Comptabilité",
    color: "#0EA5E9",
    light: "rgba(14,165,233,0.12)",
    grad: "linear-gradient(90deg,#0EA5E9,#38BDF8)",
    shadow: "rgba(14,165,233,0.3)",
    items: [
      {
        title: "Tableau de bord Comptabilité",
        url: "/compta-dashboard",
        ready: true,
      },
      { title: "Journal Comptable", url: "/comptabilite", ready: true },
      { title: "Écritures Comptables", url: "/ecritures-comptables", ready: true },
      { title: "Plan Comptable", url: "/plan-comptable", ready: true },
      { title: "Balance Comptable", url: "/balance", ready: true },
      { title: "Grand Livre", url: "/grand-livre", ready: true },
      { title: "États financiers annuels", url: "/etats-comptables", ready: true },
      { title: "Export FEC", url: "/comptabilite/fec", ready: true },
      { title: "Rapports Comptables", url: "/rapports-comptables", ready: true },
      { title: "Exercices", url: "/exercices", ready: true },
    ],
  },
  {
    label: "Ressources humaines",
    color: "#8B5CF6",
    light: "rgba(139,92,246,0.12)",
    grad: "linear-gradient(90deg,#8B5CF6,#A78BFA)",
    shadow: "rgba(139,92,246,0.3)",
    items: [
      { title: "Tableau de bord RH", url: "/rh-dashboard", ready: true },
      { title: "Employés", url: "/employes", ready: true },
      { title: "Départements", url: "/departements", ready: true },
      { title: "Fonctions / Postes", url: "/fonctions", ready: true },
      { title: "Contrats", url: "/contrats", ready: true },
      { title: "Congés", url: "/conges", ready: true },
      { title: "Absences", url: "/absences", ready: true },
      { title: "Missions", url: "/missions", ready: true },
      { title: "Évaluations", url: "/evaluations", ready: true },
    ],
  },
  {
    label: "Paie",
    color: "#EC4899",
    light: "rgba(236,72,153,0.12)",
    grad: "linear-gradient(90deg,#EC4899,#F472B6)",
    shadow: "rgba(236,72,153,0.3)",
    items: [
      { title: "Tableau de bord Paie", url: "/paie-dashboard", ready: true },
      { title: "Bulletins de salaire", url: "/paie", ready: true },
      { title: "Paramètres de paie", url: "/paie-parametres", ready: true },
      { title: "Rubriques de paie", url: "/paie-rubriques", ready: true },
      { title: "Déclarations de paie", url: "/paie-declarations", ready: true },
      { title: "Historique des paies", url: "/paie-historique", ready: true },
      { title: "Génération mensuelle", url: "/paie-generation", ready: true },
      { title: "Exports PDF / Excel", url: "/paie-exports", ready: true },
      { title: "Rapports de paie", url: "/paie-rapports", ready: true },
    ],
  },
  {
    label: "Notifications",
    color: "#EF4444",
    light: "rgba(239,68,68,0.12)",
    grad: "linear-gradient(90deg,#EF4444,#F87171)",
    shadow: "rgba(239,68,68,0.3)",
    items: [
      { title: "Notifications", url: "/notifications", ready: true },
      { title: "Historique des envois", url: "/historique-envois", ready: true },
    ],
  },
  {
    label: "Administration",
    color: "#6366F1",
    light: "rgba(99,102,241,0.12)",
    grad: "linear-gradient(90deg,#6366F1,#818CF8)",
    shadow: "rgba(99,102,241,0.3)",
    superAdminOnly: true,
    items: [
      { title: "Tableau de bord sécurité", url: "/admin/securite", ready: true },
      { title: "Utilisateurs", url: "/utilisateurs", ready: true },
      { title: "Rôles & Permissions", url: "/admin/roles-v3", ready: true },
      // v1 legacy masquée du menu (tous les utilisateurs migrés) — ancien écran supprimé
      { title: "Journal d'audit", url: "/audit", ready: true },
      { title: "Backup", url: "/backup", ready: true },
      { title: "Santé du système", url: "/admin/sante-systeme", ready: true },
      {
        title: "Renommage des clients",
        url: "/admin/renommage-clients",
        ready: true,
      },
      {
        title: "Apparence des documents",
        url: "/admin/apparence-documents",
        ready: true,
      },
    ],
  },
  {
    label: "Mon compte",
    color: "#0EA5E9",
    light: "rgba(14,165,233,0.12)",
    grad: "linear-gradient(90deg,#0EA5E9,#38BDF8)",
    shadow: "rgba(14,165,233,0.3)",
    items: [
      { title: "Mon profil", url: "/profil", ready: true },
      { title: "Documentation", url: "/documentation", ready: true },
    ],
  },
];
