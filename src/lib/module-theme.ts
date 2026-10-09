// Theme engine par module.
// Chaque module de l'ERP possède sa propre couleur d'identité. Ce module
// mappe un pathname vers la couleur du module, puis génère un jeu de
// variables CSS qui remplacent les tokens shadcn (`--primary`, `--ring`,
// `--accent`, ...) dans un sous-arbre du DOM. Tous les composants qui
// utilisent `bg-primary`, `text-primary`, `ring-primary`, etc. héritent
// donc automatiquement de la couleur du module courant.
import type { CSSProperties } from "react";

type ModuleDef = { prefixes: string[]; color: string };

// Ordre important : le premier préfixe qui matche gagne. Les préfixes plus
// spécifiques sont donc listés avant les préfixes courts.
const MODULES: ModuleDef[] = [
  {
    color: "#3B82F6", // Tableau de bord
    prefixes: [
      "/dashboard",
      "/rapports/analyse",
      "/rapports",
    ],
  },
  {
    color: "#10B981", // Stocks & logistique
    prefixes: [
      "/produits",
      "/depots",
      "/achats",
      "/stock",
      "/inventaires",
      "/incidents",
      "/alertes-stock",
      "/fournisseurs",
      "/transferts",
      "/fleet",
      "/logistics-costs",
      "/tournees",
      "/livreurs",
      "/dashboard-logistique",
      "/rapports-logistique",
    ],
  },
  {
    color: "#EAB308", // Finances
    prefixes: ["/finances", "/fne", "/etat-compte-clients"],
  },
  {
    color: "#0EA5E9", // Comptabilité
    prefixes: [
      "/compta-dashboard",
      "/comptabilite",
      "/ecritures-comptables",
      "/plan-comptable",
      "/balance",
      "/grand-livre",
      "/etats-comptables",
      "/rapports-comptables",
    ],
  },
  {
    color: "#8B5CF6", // Ressources humaines
    prefixes: [
      "/rh-dashboard",
      "/employes",
      "/departements",
      "/fonctions",
      "/contrats",
      "/conges",
      "/absences",
      "/missions",
      "/evaluations",
    ],
  },
  {
    color: "#EC4899", // Paie
    prefixes: ["/paie"],
  },
  {
    color: "#EF4444", // Notifications
    prefixes: ["/notifications", "/historique-envois"],
  },
  {
    color: "#F59E0B", // Documents & sauvegardes
    prefixes: ["/file-storage", "/backup"],
  },
  {
    color: "#6366F1", // Administration
    prefixes: [
      "/utilisateurs",
      "/import-donnees",
      "/exports",
      "/audit",
      "/exercices",
      "/profil",
      "/centre-documents",
    ],
  },
  {
    color: "#F97316", // Gestion commerciale (défaut / fallback)
    prefixes: [
      "/clients",
      "/commandes",
      "/proformas",
      "/factures",
      "/bons-livraison",
      "/colisage",
      "/livraison-suivi",
      "/paiements",
      "/retours",
      "/specimens",
    ],
  },
];

const DEFAULT_COLOR = "#F97316";

export function getModuleColor(pathname: string): string {
  for (const m of MODULES) {
    for (const p of m.prefixes) {
      if (pathname === p || pathname.startsWith(p + "/")) return m.color;
    }
  }
  return DEFAULT_COLOR;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/** Choisit un texte lisible (blanc ou quasi-noir) selon WCAG. */
export function readableTextOn(hex: string): string {
  return relLuminance(hexToRgb(hex)) > 0.5 ? "#111827" : "#FFFFFF";
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/**
 * Construit un jeu de variables CSS à appliquer sur un conteneur pour que
 * tous les composants shadcn (Button, Badge, Tabs, Switch, ...) adoptent
 * automatiquement la couleur du module courant.
 */
export function buildModuleThemeVars(color: string): CSSProperties {
  const fg = readableTextOn(color);
  return {
    ["--primary" as string]: color,
    ["--primary-foreground" as string]: fg,
    ["--ring" as string]: color,
    ["--sidebar-primary" as string]: color,
    ["--sidebar-ring" as string]: color,
    ["--chart-1" as string]: color,
    ["--accent" as string]: rgba(color, 0.12),
    ["--accent-foreground" as string]: color,
  } as CSSProperties;
}
