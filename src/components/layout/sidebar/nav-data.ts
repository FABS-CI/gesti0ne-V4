import {
  LayoutDashboard,
  BarChart3,
  Users,
  ShoppingCart,
  FileSignature,
  FileText,
  CreditCard,
  Truck,
  RotateCcw,
  Package,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  Car,
  DollarSign,
  Building2,
  Inbox,
  Wallet,
  Calculator,
  ShieldCheck,
  Briefcase,
  CalendarDays,
  UserX,
  MapPin,
  Bell,
  HardDrive,
  Upload,
  Database,
  Download,
  UserCog,
  Settings,
  Printer,
  UserCircle,
  History,
  Warehouse,
  FolderArchive,
  Shield,
  Star,
  Scale,
  Gift,
  ListTree,
  PlayCircle,
  Navigation,
} from "lucide-react";

export type Item = {
  title: string;
  url: string;
  icon: typeof Users;
  ready?: boolean;
  /**
   * Nom du sous-dossier (section repliable) affiché dans le menu.
   * Uniquement visuel : n'affecte ni le routage, ni le RBAC, ni les URLs.
   */
  section?: string;
  /** Si défini, affiche un badge dynamique piloté par ce hook. */
  badge?: "approbations";
};
export type Group = {
  label: string;
  groupIcon: typeof Users;
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
    groupIcon: LayoutDashboard,
    color: "#3B82F6",
    light: "rgba(59,130,246,0.12)",
    grad: "linear-gradient(90deg,#3B82F6,#60A5FA)",
    shadow: "rgba(59,130,246,0.3)",
    items: [
      { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard, ready: true },
      { title: "Mon tableau de bord", url: "/mon-dashboard", icon: LayoutDashboard, ready: true },
      { title: "Vue globale", url: "/dashboard-global", icon: LayoutDashboard, ready: true },
      { title: "Business Intelligence", url: "/bi-analytics", icon: BarChart3, ready: true },
      { title: "Rapports", url: "/rapports", icon: BarChart3, ready: true },
      { title: "Analyse des ventes", url: "/rapports/analyse", icon: BarChart3, ready: true },
      { title: "Frais de transport", url: "/rapports/transport", icon: BarChart3, ready: true },
    ],
  },
  {
    label: "Gestion commerciale",
    groupIcon: ShoppingCart,
    color: "#F97316",
    light: "rgba(249,115,22,0.12)",
    grad: "linear-gradient(90deg,#F97316,#FB923C)",
    shadow: "rgba(249,115,22,0.3)",
    items: [
      { title: "Clients", url: "/clients", icon: Users, ready: true },
      { title: "CRM & Analyses", url: "/clients/dashboard", icon: Users, ready: true },
      { title: "Commandes", url: "/commandes", icon: ShoppingCart, ready: true },
      { title: "Proformas", url: "/proformas", icon: FileSignature, ready: true },
      { title: "Factures", url: "/factures", icon: FileText, ready: true },
      { title: "Paiements", url: "/paiements", icon: CreditCard, ready: true },
      { title: "Retours", url: "/retours", icon: RotateCcw, ready: true },
      { title: "Spécimens", url: "/specimens", icon: Gift, ready: true },
      { title: "Approbations", url: "/approbations", icon: ShieldCheck, ready: true, badge: "approbations" },
    ],
  },
  {
    label: "Stocks & Logistique",
    groupIcon: Warehouse,
    color: "#10B981",
    light: "rgba(16,185,129,0.12)",
    grad: "linear-gradient(90deg,#10B981,#34D399)",
    shadow: "rgba(16,185,129,0.3)",
    items: [
      // 📂 Catalogue — Données de référence
      { title: "Produits", url: "/produits", icon: BookOpen, ready: true, section: "Catalogue" },
      { title: "Dépôts", url: "/depots", icon: Warehouse, ready: true, section: "Catalogue" },
      { title: "Fournisseurs", url: "/fournisseurs", icon: Building2, ready: true, section: "Catalogue" },

      // 📂 Réception — Entrées de marchandises
      { title: "Approvisionnements", url: "/achats", icon: Inbox, ready: true, section: "Réception" },
      { title: "Mouvements", url: "/stock", icon: Package, ready: true, section: "Réception" },

      // 📂 Stock — Gestion et contrôle des stocks
      { title: "Transferts", url: "/transferts", icon: Warehouse, ready: true, section: "Stock" },
      { title: "Inventaires", url: "/inventaires", icon: ClipboardList, ready: true, section: "Stock" },
      { title: "Alertes de Stock", url: "/alertes-stock", icon: AlertTriangle, ready: true, section: "Stock" },
      { title: "Incidents de Stock", url: "/incidents", icon: AlertTriangle, ready: true, section: "Stock" },
      { title: "Audit stock", url: "/stock/audit", icon: ClipboardList, ready: true, section: "Stock" },

      // 📂 Préparation — Préparation des commandes
      { title: "Colisage", url: "/colisage", icon: Package, ready: true, section: "Préparation" },
      {
        title: "Préparateurs / Responsables colisage",
        url: "/colisage/responsables",
        icon: UserCog,
        ready: true,
        section: "Préparation",
      },
      { title: "Bons de livraison", url: "/bons-livraison", icon: Truck, ready: true, section: "Préparation" },

      // 📂 Livraison — Transport et suivi
      { title: "Livreurs", url: "/livreurs", icon: Users, ready: true, section: "Livraison" },
      { title: "Flotte", url: "/fleet", icon: Car, ready: true, section: "Livraison" },
      { title: "Tournées", url: "/tournees", icon: Navigation, ready: true, section: "Livraison" },
      { title: "Suivi des livraisons", url: "/livraison-suivi", icon: Truck, ready: true, section: "Livraison" },

      // 📂 Analyse — Indicateurs et rapports
      { title: "Dashboard logistique", url: "/dashboard-logistique", icon: BarChart3, ready: true, section: "Analyse" },
      { title: "Rapports logistique", url: "/rapports-logistique", icon: BarChart3, ready: true, section: "Analyse" },
    ],
  },
  {
    label: "Finances",
    groupIcon: Wallet,
    color: "#EAB308",
    light: "rgba(234,179,8,0.18)",
    grad: "linear-gradient(90deg,#EAB308,#FACC15)",
    shadow: "rgba(234,179,8,0.35)",
    activeText: "#111827",
    items: [
      { title: "Tableau de bord Financier", url: "/finances", icon: Wallet, ready: true },
      { title: "FNE", url: "/fne", icon: ShieldCheck, ready: true },
      {
        title: "États de compte clients",
        url: "/etat-compte-clients",
        icon: FileText,
        ready: true,
      },
      {
        title: "Coûts logistiques",
        url: "/logistics-costs",
        icon: DollarSign,
        ready: true,
      },
    ],
  },
  {
    label: "Comptabilité",
    groupIcon: Calculator,
    color: "#0EA5E9",
    light: "rgba(14,165,233,0.12)",
    grad: "linear-gradient(90deg,#0EA5E9,#38BDF8)",
    shadow: "rgba(14,165,233,0.3)",
    items: [
      {
        title: "Tableau de bord Comptabilité",
        url: "/compta-dashboard",
        icon: Calculator,
        ready: true,
      },
      { title: "Journal Comptable", url: "/comptabilite", icon: BookOpen, ready: true },
      { title: "Écritures Comptables", url: "/ecritures-comptables", icon: BookOpen, ready: true },
      { title: "Plan Comptable", url: "/plan-comptable", icon: ListTree, ready: true },
      { title: "Balance Comptable", url: "/balance", icon: Scale, ready: true },
      { title: "Grand Livre", url: "/grand-livre", icon: FileText, ready: true },
      { title: "États Comptables", url: "/etats-comptables", icon: FileText, ready: true },
      { title: "Export FEC", url: "/comptabilite/fec", icon: FileText, ready: true },
      { title: "Rapports Comptables", url: "/rapports-comptables", icon: BarChart3, ready: true },
      { title: "Exercices", url: "/exercices", icon: CalendarDays, ready: true },
    ],
  },
  {
    label: "Ressources humaines",
    groupIcon: Briefcase,
    color: "#8B5CF6",
    light: "rgba(139,92,246,0.12)",
    grad: "linear-gradient(90deg,#8B5CF6,#A78BFA)",
    shadow: "rgba(139,92,246,0.3)",
    items: [
      { title: "Tableau de bord RH", url: "/rh-dashboard", icon: Briefcase, ready: true },
      { title: "Employés", url: "/employes", icon: Users, ready: true },
      { title: "Départements", url: "/departements", icon: Building2, ready: true },
      { title: "Fonctions / Postes", url: "/fonctions", icon: Briefcase, ready: true },
      { title: "Contrats", url: "/contrats", icon: FileText, ready: true },
      { title: "Congés", url: "/conges", icon: CalendarDays, ready: true },
      { title: "Absences", url: "/absences", icon: UserX, ready: true },
      { title: "Missions", url: "/missions", icon: MapPin, ready: true },
      { title: "Évaluations", url: "/evaluations", icon: Star, ready: true },
    ],
  },
  {
    label: "Paie",
    groupIcon: Wallet,
    color: "#EC4899",
    light: "rgba(236,72,153,0.12)",
    grad: "linear-gradient(90deg,#EC4899,#F472B6)",
    shadow: "rgba(236,72,153,0.3)",
    items: [
      { title: "Tableau de bord Paie", url: "/paie-dashboard", icon: Wallet, ready: true },
      { title: "Bulletins de salaire", url: "/paie", icon: FileText, ready: true },
      { title: "Paramètres de paie", url: "/paie-parametres", icon: Settings, ready: true },
      { title: "Rubriques de paie", url: "/paie-rubriques", icon: FileText, ready: true },
      { title: "Déclarations de paie", url: "/paie-declarations", icon: FileText, ready: true },
      { title: "Historique des paies", url: "/paie-historique", icon: History, ready: true },
      { title: "Génération mensuelle", url: "/paie-generation", icon: PlayCircle, ready: true },
      { title: "Exports PDF / Excel", url: "/paie-exports", icon: Download, ready: true },
      { title: "Rapports de paie", url: "/paie-rapports", icon: BarChart3, ready: true },
    ],
  },
  {
    label: "Notifications",
    groupIcon: Bell,
    color: "#EF4444",
    light: "rgba(239,68,68,0.12)",
    grad: "linear-gradient(90deg,#EF4444,#F87171)",
    shadow: "rgba(239,68,68,0.3)",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell, ready: true },
      { title: "Historique des envois", url: "/historique-envois", icon: History, ready: true },
    ],
  },
  {
    label: "Administration",
    groupIcon: Shield,
    color: "#6366F1",
    light: "rgba(99,102,241,0.12)",
    grad: "linear-gradient(90deg,#6366F1,#818CF8)",
    shadow: "rgba(99,102,241,0.3)",
    superAdminOnly: true,
    items: [
      { title: "Tableau de bord sécurité", url: "/admin/securite", icon: Shield, ready: true },
      { title: "Utilisateurs", url: "/utilisateurs", icon: UserCog, ready: true },
      { title: "Rôles & Permissions", url: "/admin/roles-v3", icon: ShieldCheck, ready: true },
      // v1 legacy masquée du menu (tous les utilisateurs migrés) — accessible via /roles-permissions pour rollback
      { title: "Journal d'audit", url: "/audit", icon: History, ready: true },
      { title: "Backup", url: "/backup", icon: Database, ready: true },
      { title: "Santé du système", url: "/admin/sante-systeme", icon: Shield, ready: true },
      { title: "Seuils d'approbation", url: "/admin/approbation-seuils", icon: Shield, ready: true },

    ],
  },
  {
    label: "Mon compte",
    groupIcon: UserCircle,
    color: "#0EA5E9",
    light: "rgba(14,165,233,0.12)",
    grad: "linear-gradient(90deg,#0EA5E9,#38BDF8)",
    shadow: "rgba(14,165,233,0.3)",
    items: [
      { title: "Mon profil", url: "/profil", icon: UserCircle, ready: true },
      { title: "Documentation", url: "/documentation", icon: BookOpen, ready: true },
    ],
  },
];
