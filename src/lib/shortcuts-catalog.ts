export interface ShortcutDef {
  key: string;
  module: string;
  label: string;
  iconName: string;
  href: string;
  permission?: string;
}

export const SHORTCUTS_CATALOG: ShortcutDef[] = [
  {
    key: "commandes.create",
    module: "commercial",
    label: "Nouvelle commande",
    iconName: "ShoppingCart",
    href: "/commandes/nouvelle",
    permission: "commandes.creer",
  },
  {
    key: "clients.create",
    module: "crm",
    label: "Nouveau client",
    iconName: "UserPlus",
    href: "/clients",
    permission: "clients.creer",
  },
  {
    key: "paiements.create",
    module: "finance",
    label: "Nouveau paiement",
    iconName: "CreditCard",
    href: "/paiements/nouveau",
    permission: "paiements.creer",
  },
  {
    key: "factures.create",
    module: "finance",
    label: "Nouvelle facture",
    iconName: "FileText",
    href: "/factures",
    permission: "factures.creer",
  },
  {
    key: "devis.create",
    module: "commercial",
    label: "Nouveau devis",
    iconName: "FileSpreadsheet",
    href: "/proformas",
    permission: "proformas.creer",
  },
  {
    key: "colisage.create",
    module: "logistique",
    label: "Nouveau colisage",
    iconName: "Package",
    href: "/colisage",
    permission: "colisage.creer",
  },
  {
    key: "reception.create",
    module: "stock",
    label: "Nouveau bon de réception",
    iconName: "PackageCheck",
    href: "/achats/nouveau",
    permission: "achats.creer",
  },
  {
    key: "articles.create",
    module: "stock",
    label: "Nouvel article",
    iconName: "Boxes",
    href: "/produits",
    permission: "produits.creer",
  },
  {
    key: "tournees.create",
    module: "logistique",
    label: "Nouvelle tournée",
    iconName: "MapPin",
    href: "/tournees",
    permission: "tournees.creer",
  },
];

export const MODULE_META: Record<string, { label: string; href: string }> = {
  commercial: { label: "Commercial", href: "/commandes" },
  finance: { label: "Finance", href: "/comptabilite" },
  stock: { label: "Stock", href: "/produits" },
  logistique: { label: "Logistique", href: "/livraisons" },
  crm: { label: "CRM", href: "/clients" },
  rh: { label: "Ressources humaines", href: "/employes" },
  flotte: { label: "Flotte", href: "/vehicules" },
};

export function findShortcut(key: string): ShortcutDef | undefined {
  return SHORTCUTS_CATALOG.find((s) => s.key === key);
}
