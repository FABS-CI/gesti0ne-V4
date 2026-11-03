import { z } from "zod";
import type { Client, ClientInput } from "@/lib/clients-api";

/**
 * Schéma du formulaire client complet (page dédiée).
 * Les champs sans colonne dédiée sont sérialisés dans `notes` sous la forme
 * ```
 * <notes libres>
 * ---META---
 * { "whatsapp": "...", "site_web": "...", ... }
 * ```
 * pour ne rien perdre sans toucher au schéma DB.
 */
export const clientFormSchema = z.object({
  // 1. Identité
  nom: z.string().trim().min(1, "Nom obligatoire").max(200),
  type_client: z.string().min(1, "Type obligatoire"),
  statut: z.enum(["actif", "inactif"]).default("actif"),
  representant: z.string().max(200).optional().or(z.literal("")),

  // 2. Coordonnées
  telephone: z.string().max(50).optional().or(z.literal("")),
  whatsapp: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Email invalide").max(255).optional().or(z.literal("")),
  site_web: z.string().max(255).optional().or(z.literal("")),


  // 3. Adresse
  pays: z.string().max(100).optional().or(z.literal("")),
  ville: z.string().max(100).optional().or(z.literal("")),
  commune: z.string().max(100).optional().or(z.literal("")),
  quartier: z.string().max(100).optional().or(z.literal("")),
  adresse: z.string().max(500).optional().or(z.literal("")),
  bp: z.string().max(50).optional().or(z.literal("")),
  gps: z.string().max(100).optional().or(z.literal("")),

  // 4. Commercial
  zone_commerciale: z.string().max(100).optional().or(z.literal("")),
  secteur_activite: z.string().max(100).optional().or(z.literal("")),
  categorie: z.string().max(100).optional().or(z.literal("")),
  canal_vente: z.string().max(100).optional().or(z.literal("")),
  circuit_distribution: z.string().max(100).optional().or(z.literal("")),

  // 5. Fiscal
  nif: z.string().max(50).optional().or(z.literal("")),
  rccm: z.string().max(100).optional().or(z.literal("")),
  compte_contribuable: z.string().max(100).optional().or(z.literal("")),
  cnps: z.string().max(100).optional().or(z.literal("")),
  regime_fiscal: z.string().optional().or(z.literal("")),
  assujetti_tva: z.boolean().default(false),

  // 6. Conditions commerciales
  mode_paiement: z.string().optional().or(z.literal("")),
  delai_paiement: z.coerce.number().int().min(0).max(365).nullable().optional(),
  plafond_credit: z.coerce.number().min(0).default(0),
  remise_habituelle: z.coerce.number().min(0).max(100).nullable().optional(),
  devise: z.string().max(10).default("XOF"),

  // 7. Livraison
  adresse_livraison: z.string().max(500).optional().or(z.literal("")),
  zone_livraison: z.string().max(100).optional().or(z.literal("")),
  depot_defaut: z.string().max(100).optional().or(z.literal("")),
  moyen_livraison: z.string().max(100).optional().or(z.literal("")),

  // 9. Notes
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

/** Téléphone saisi → 10 chiffres ivoiriens (indicatif +225 / 00225 retiré), sinon chiffres bruts. */
export function telephoneChiffres(tel: string): string {
  const chiffres = tel.replace(/\D/g, "").replace(/^00/, "");
  return chiffres.length === 13 && chiffres.startsWith("225") ? chiffres.slice(3) : chiffres;
}

/**
 * Création rapide d'un client : cinq informations, le reste se complète depuis la fiche.
 * Le téléphone est stocké en 10 chiffres (format des clients existants), affiché en +225.
 */
export const clientRapideSchema = z.object({
  nom: z.string().trim().min(1, "Entrez le nom du client").max(200),
  type_client: z.string().min(1, "Choisissez un type"),
  representant: z.string().trim().max(200).optional().or(z.literal("")),
  telephone: z
    .string()
    .transform(telephoneChiffres)
    .refine((t) => t.length === 10, "Numéro à 10 chiffres attendu (ex. 07 59 69 98 11)"),
  ville: z.string().trim().min(1, "Choisissez la ville").max(100),
});

export type ClientRapideValues = z.output<typeof clientRapideSchema>;

export const META_MARK = "\n---META---\n";

const META_KEYS = [
  "whatsapp",
  "site_web",
  "gps",
  "zone_commerciale",
  "canal_vente",
  "circuit_distribution",
  "rccm",
  "compte_contribuable",
  "cnps",
  "assujetti_tva",
  "devise",
  "adresse_livraison",
  "zone_livraison",
  "depot_defaut",
  "moyen_livraison",
  "statut",
] as const;


type MetaExtra = Partial<Record<(typeof META_KEYS)[number], unknown>>;

function splitNotes(raw: string | null | undefined): { notes: string; meta: MetaExtra } {
  if (!raw) return { notes: "", meta: {} };
  const idx = raw.indexOf(META_MARK);
  if (idx === -1) return { notes: raw, meta: {} };
  const notes = raw.slice(0, idx);
  const jsonPart = raw.slice(idx + META_MARK.length).trim();
  try {
    const meta = jsonPart ? (JSON.parse(jsonPart) as MetaExtra) : {};
    return { notes, meta };
  } catch {
    return { notes: raw, meta: {} };
  }
}

function packNotes(notes: string, values: ClientFormValues): string {
  const meta: MetaExtra = {};
  for (const k of META_KEYS) {
    const v = values[k as keyof ClientFormValues];
    if (v === undefined || v === null || v === "" || v === false) continue;
    meta[k] = v;
  }
  const hasMeta = Object.keys(meta).length > 0;
  const cleanNotes = notes ?? "";
  if (!hasMeta) return cleanNotes;
  return `${cleanNotes}${META_MARK}${JSON.stringify(meta)}`;
}

/** Valeurs par défaut d'un nouveau formulaire. */
export const emptyClientFormValues: ClientFormValues = {
  nom: "",
  type_client: "autre",
  statut: "actif",
  representant: "",
  telephone: "",

  whatsapp: "",
  email: "",
  site_web: "",
  pays: "Côte d'Ivoire",
  ville: "",
  commune: "",
  quartier: "",
  adresse: "",
  bp: "",
  gps: "",
  zone_commerciale: "",
  secteur_activite: "",
  categorie: "",
  canal_vente: "",
  circuit_distribution: "",
  nif: "",
  rccm: "",
  compte_contribuable: "",
  cnps: "",
  regime_fiscal: "",
  assujetti_tva: false,
  mode_paiement: "",
  delai_paiement: null,
  plafond_credit: 0,
  remise_habituelle: null,
  devise: "XOF",
  adresse_livraison: "",
  zone_livraison: "",
  depot_defaut: "",
  moyen_livraison: "",
  notes: "",
};

/** Convertit un `Client` (DB) vers les valeurs du formulaire. */
export function clientToFormValues(c: Client): ClientFormValues {
  const { notes, meta } = splitNotes(c.notes);
  return {
    ...emptyClientFormValues,
    nom: c.nom ?? "",
    type_client: c.type_client ?? "autre",
    statut: (c.statut === "inactif" || c.actif === false) ? "inactif" : "actif",
    representant: c.representant ?? "",
    telephone: c.telephone ?? "",

    whatsapp: (meta.whatsapp as string) ?? "",
    email: c.email ?? "",
    site_web: (meta.site_web as string) ?? "",
    pays: c.pays ?? "Côte d'Ivoire",
    ville: c.ville ?? "",
    commune: c.commune ?? "",
    quartier: c.quartier ?? "",
    adresse: c.adresse ?? "",
    bp: c.bp ?? "",
    gps: (meta.gps as string) ?? "",
    zone_commerciale: (meta.zone_commerciale as string) ?? "",
    secteur_activite: c.secteur_activite ?? "",
    categorie: c.categorie ?? "",
    canal_vente: (meta.canal_vente as string) ?? "",
    circuit_distribution: (meta.circuit_distribution as string) ?? "",
    nif: c.nif ?? "",
    rccm: (meta.rccm as string) ?? "",
    compte_contribuable: (meta.compte_contribuable as string) ?? "",
    cnps: (meta.cnps as string) ?? "",
    regime_fiscal: c.regime_fiscal ?? "",
    assujetti_tva: Boolean(meta.assujetti_tva),
    mode_paiement: c.mode_paiement ?? "",
    delai_paiement: c.delai_paiement,
    plafond_credit: c.plafond_credit ?? 0,
    remise_habituelle: c.remise_habituelle,
    devise: (meta.devise as string) ?? "XOF",
    adresse_livraison: (meta.adresse_livraison as string) ?? "",
    zone_livraison: (meta.zone_livraison as string) ?? "",
    depot_defaut: (meta.depot_defaut as string) ?? "",
    moyen_livraison: (meta.moyen_livraison as string) ?? "",
    notes,
  };
}

/** Convertit les valeurs du formulaire vers un `ClientInput` (API). */
export function formValuesToClientInput(v: ClientFormValues): ClientInput {
  const empty = (s: string | null | undefined) => (s && s.trim() !== "" ? s : null);
  return {
    nom: v.nom.trim(),
    type_client: v.type_client,
    representant: empty(v.representant),
    telephone: empty(v.telephone),
    email: empty(v.email),
    adresse: empty(v.adresse),
    quartier: empty(v.quartier),
    commune: empty(v.commune),
    ville: empty(v.ville),
    bp: empty(v.bp),
    pays: empty(v.pays),

    nif: empty(v.nif),
    regime_fiscal: empty(v.regime_fiscal),
    categorie: empty(v.categorie),
    secteur_activite: empty(v.secteur_activite),
    mode_paiement: empty(v.mode_paiement),
    delai_paiement: v.delai_paiement ?? null,
    remise_habituelle: v.remise_habituelle ?? null,
    plafond_credit: v.plafond_credit ?? 0,
    notes: packNotes(v.notes ?? "", v),
  };
}

export const REGIMES_FISCAUX = [
  { value: "reel_normal", label: "Réel Normal" },
  { value: "reel_simplifie", label: "Réel Simplifié" },
  { value: "micro_entreprise", label: "Micro Entreprise" },
  { value: "exonere", label: "Exonéré" },
];

export const MODES_PAIEMENT = [
  { value: "comptant", label: "Comptant" },
  { value: "credit", label: "Crédit" },
  { value: "cheque", label: "Chèque" },
  { value: "virement", label: "Virement" },
  { value: "mobile_money", label: "Mobile Money" },
];