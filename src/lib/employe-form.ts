import { z } from "zod";

const optStr = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const optDate = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));
const optEmail = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Email invalide" });

export const employeSchema = z
  .object({
    // Identité
    nom_complet: z.string().trim().min(1, "Le nom est requis").max(150),
    matricule: optStr,
    prenoms: optStr,
    sexe: z.enum(["M", "F", "autre"]).nullable().optional(),
    date_naissance: optDate,
    lieu_naissance: optStr,
    nationalite: optStr,
    situation_matrimoniale: z
      .enum(["celibataire", "marie", "divorce", "veuf", "union_libre"])
      .nullable()
      .optional(),
    photo_url: optStr,
    numero_cni: optStr,
    numero_cnps: optStr,
    numero_securite_sociale: optStr,
    // Contact
    adresse: optStr,
    commune: optStr,
    ville: optStr,
    pays: optStr,
    email: optEmail,
    telephone: optStr,
    telephone_secondaire: optStr,
    // Professionnel
    departement: z.string().min(1),
    fonction_id: optStr,
    poste: optStr,
    service: optStr,
    responsable_hierarchique_id: optStr,
    type_contrat: z
      .enum(["CDI", "CDD", "stage", "consultant", "interim", "apprentissage"])
      .nullable()
      .optional(),
    date_embauche: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'embauche requise"),
    date_fin_contrat: optDate,
    statut_employe: z
      .enum(["actif", "suspendu", "demission", "licencie", "retraite", "fin_contrat"])
      .nullable()
      .optional(),
    temps_travail: z.enum(["temps_plein", "temps_partiel", "forfait_jour"]).nullable().optional(),
    categorie: optStr,
    echelon: optStr,
    site_affectation: optStr,
    actif: z.boolean(),
    // Financier
    salaire: z.number().min(0, "Le salaire doit être positif"),
    primes: z
      .array(z.object({ libelle: z.string().min(1), montant: z.number().min(0) }))
      .default([]),
    indemnites: z
      .array(z.object({ libelle: z.string().min(1), montant: z.number().min(0) }))
      .default([]),
    avantages: z
      .array(z.object({ libelle: z.string().min(1), valeur: z.string().optional() }))
      .default([]),
    mode_paiement: z.enum(["virement", "cheque", "especes", "mobile_money"]).nullable().optional(),
    banque: optStr,
    numero_compte: optStr,
    devise: optStr,
    centre_cout: optStr,
    // Administratif
    niveau_etudes: optStr,
    diplomes: z
      .array(
        z.object({
          intitule: z.string().min(1),
          annee: z.number().int().min(1900).max(2100).optional(),
          etablissement: z.string().optional(),
        }),
      )
      .default([]),
    competences: z.array(z.string().min(1)).default([]),
    certifications: z
      .array(
        z.object({
          intitule: z.string().min(1),
          annee: z.number().int().min(1900).max(2100).optional(),
          organisme: z.string().optional(),
        }),
      )
      .default([]),
    contact_urgence_nom: optStr,
    contact_urgence_telephone: optStr,
    contact_urgence_lien: optStr,
    observations: optStr,
  })
  .superRefine((val, ctx) => {
    if (val.date_fin_contrat && val.date_embauche && val.date_fin_contrat < val.date_embauche) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_fin_contrat"],
        message: "La date de fin doit être postérieure à la date d'embauche",
      });
    }
    if (val.date_naissance && val.date_naissance > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_naissance"],
        message: "La date de naissance ne peut être dans le futur",
      });
    }
  });

export type EmployeFormValues = z.input<typeof employeSchema>;
export type EmployeFormOutput = z.output<typeof employeSchema>;
