export const COMPANY = {
  nom: "EDITIONS FABS-CI",
  adresse: "Bingerville, Quartier N'Gotto, Immeuble Cité Angan A. fils et petits-fils, RDC, BP 693",
  telephones: ["+225 07 59 73 71 23", "+225 21 22 80 09 95"],
  email: "edition693fabs@gmail.com",
  rccm: "CI-ABJ-03-2023-B12-03073",
  ncc: "2302562N",
  dg: "ALI MAMIN",
  devise: "FCFA",
  tva: "Exonéré 0%",
  anneeScolaire: "2026-2027",
  slogan: "Une innovation pour une école de qualité",
} as const;

export const ROLES: Record<string, string> = {
  super_admin: "Super Administrateur",
  directeur_general: "Directeur Général",
  comptable: "Comptable",
  directeur_commercial: "Directeur Commercial",
  gestionnaire_stock: "Gestionnaire de Stock",
  responsable_magasinier: "Responsable Magasinier",
  secretariat: "Secrétariat",
  assistante: "Assistante",
  assistante_comptable: "Assistante Comptable",
  service_logistique: "Service Logistique",
};

export type TypeClient = {
  value: string;
  label: string;
  color: string;
  bg: string;
};

export const TYPE_CLIENTS: TypeClient[] = [
  { value: "librairie", label: "Librairie", color: "#FFFFFF", bg: "#0A2540" },
  { value: "lycee", label: "Lycée", color: "#FFFFFF", bg: "#1565C0" },
  { value: "college", label: "Collège", color: "#FFFFFF", bg: "#0288D1" },
  { value: "groupe_scolaire", label: "Groupe Scolaire", color: "#FFFFFF", bg: "#00796B" },
  { value: "epp", label: "EPP", color: "#FFFFFF", bg: "#558B2F" },
  { value: "iep", label: "IEP", color: "#FFFFFF", bg: "#2E7D32" },
  { value: "catholique", label: "Catholique", color: "#FFFFFF", bg: "#6A1B9A" },
  { value: "methodiste", label: "Méthodiste", color: "#FFFFFF", bg: "#4A148C" },
  { value: "particulier", label: "Particulier", color: "#0A2540", bg: "#E5E7EB" },
  { value: "distributeur", label: "Distributeur", color: "#FFFFFF", bg: "#FF6200" },
  { value: "representant", label: "Représentant", color: "#FFFFFF", bg: "#7C3AED" },
  { value: "memo", label: "Mémo / APFC", color: "#FFFFFF", bg: "#F57F17" },
  { value: "inspecteur", label: "Inspecteur", color: "#FFFFFF", bg: "#BF360C" },
  { value: "dren", label: "DREN", color: "#FFFFFF", bg: "#880E4F" },
  { value: "up", label: "UP", color: "#FFFFFF", bg: "#37474F" },
  { value: "institut", label: "Institut", color: "#FFFFFF", bg: "#4E342E" },
  { value: "ecole", label: "École", color: "#FFFFFF", bg: "#388E3C" },
  { value: "autre", label: "Autre", color: "#0A2540", bg: "#CFD8DC" },
];

export const TYPE_COLOR: Record<string, TypeClient> = Object.fromEntries(
  TYPE_CLIENTS.map((t) => [t.value, t]),
);

export const CATEGORIES_PRODUIT: { value: string; label: string }[] = [
  { value: "manuel", label: "Manuel scolaire" },
  { value: "cahier_activite", label: "Cahier d'activités" },
  { value: "livre_lecture", label: "Livre de lecture" },
  { value: "guide_pedagogique", label: "Guide pédagogique" },
  { value: "parascolaire", label: "Parascolaire" },
  { value: "fourniture", label: "Fourniture" },
  { value: "autre", label: "Autre" },
];

export const CATEGORIE_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES_PRODUIT.map((c) => [c.value, c.label]),
);

/**
 * La base contient des variantes historiques d'un même type de client
 * (« librairies » vs « librairie », « lycees » vs « lycee », casse/accents/espaces).
 * On normalise vers la valeur canonique de TYPE_CLIENTS.
 */
export function normalizeTypeClient(value?: string | null): string {
  const s = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!s) return "";
  if (TYPE_COLOR[s]) return s;
  if (s.endsWith("s") && TYPE_COLOR[s.slice(0, -1)]) return s.slice(0, -1);
  if (TYPE_COLOR[`${s}s`]) return `${s}s`;
  return s;
}

/** Toutes les variantes stockées en base correspondant à un type canonique. */
export function typeClientVariants(value: string): string[] {
  const base = normalizeTypeClient(value);
  const set = new Set<string>([value, base, `${base}s`]);
  if (base.endsWith("s")) set.add(base.slice(0, -1));
  return [...set].filter(Boolean);
}
