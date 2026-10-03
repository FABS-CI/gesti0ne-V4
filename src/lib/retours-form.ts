import { z } from "zod";

export const retourLigneSchema = z.object({
  produit_id: z.string().min(1, "Sélectionnez un produit"),
  reference_produit: z.string().nullable().optional(),
  designation: z.string().min(1, "Désignation requise"),
  quantite: z.number().int().min(1, "Quantité ≥ 1"),
  prix_unitaire: z.number().min(0, "Prix invalide").optional(),
  remise_pct: z.number().min(0, "Remise ≥ 0").max(100, "Remise ≤ 100").optional(),
  etat_produit: z.enum(["revendable", "endommage", "perdu"]).optional(),
  motif: z.string().optional(),
  qte_disponible: z.number().int().optional(),
});

export const retourFormSchema = z
  .object({
    date_retour: z.string().min(1, "Date requise"),
    client_id: z.string().min(1, "Sélectionnez un client"),
    facture_id: z.string().uuid("Sélectionnez la facture d'origine").optional().or(z.literal("")),
    livraison_id: z.string().uuid("Sélectionnez la livraison d'origine").optional().or(z.literal("")),
    type_retour: z.enum(["physique", "avoir"]),
    etablissement: z.string().optional(),
    representant_nom: z.string().optional(),
    telephone: z.string().optional(),
    ville: z.string().optional(),
    adresse: z.string().optional(),
    observations: z.string().optional(),
    depot_id: z.string().optional(),
    niveau_urgence: z.enum(["normal", "urgent", "critique"]).optional(),
    motif: z.string().optional(),
    remise_globale_pct: z.number().min(0).max(100).optional(),
    lignes: z.array(retourLigneSchema).min(1, "Ajoutez au moins une ligne produit"),
  })
  .superRefine((val, ctx) => {
    // Document d'origine obligatoire
    if (!val.facture_id && !val.livraison_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facture_id"],
        message: "Sélectionnez la facture (ou la livraison) d'origine",
      });
    }
    // Pas de doublons de produit
    const ids = val.lignes.map((l) => l.produit_id).filter(Boolean);
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lignes", i, "produit_id"],
          message: "Ce produit est déjà présent dans une autre ligne",
        });
      }
      seen.add(id);
    });
    // Quantité ≤ disponible (quand rattaché à une facture)
    val.lignes.forEach((l, i) => {
      if (l.qte_disponible !== undefined && l.quantite > l.qte_disponible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lignes", i, "quantite"],
          message: `Quantité > disponible (${l.qte_disponible})`,
        });
      }
    });
  });

export type RetourFormValues = z.infer<typeof retourFormSchema>;

/** Calculs dynamiques d'une ligne de retour (identiques au moteur en base). */
export function calcLigneRetour(l: {
  quantite?: number;
  prix_unitaire?: number | null;
  remise_pct?: number | null;
}) {
  const brut = Math.max(0, Number(l.quantite ?? 0)) * Math.max(0, Number(l.prix_unitaire ?? 0));
  const remise = Math.round((brut * Math.min(100, Math.max(0, Number(l.remise_pct ?? 0)))) / 100);
  return { brut, remise, net: brut - remise };
}

/** Totaux d'un retour : HT brut, remises, total final. */
export function calcTotauxRetour(
  lignes: Array<{ quantite?: number; prix_unitaire?: number | null; remise_pct?: number | null }>,
  remiseGlobalePct = 0,
) {
  const acc = { brut: 0, remise: 0, net: 0, quantite: 0, remiseGlobale: 0 };
  for (const l of lignes) {
    const c = calcLigneRetour(l);
    acc.brut += c.brut;
    acc.remise += c.remise;
    acc.net += c.net;
    acc.quantite += Math.max(0, Number(l.quantite ?? 0));
  }
  // Remise globale de la facture d'origine, appliquée après les remises de ligne (identique au moteur en base).
  const pct = Math.min(100, Math.max(0, Number(remiseGlobalePct) || 0));
  acc.remiseGlobale = Math.round((acc.net * pct) / 100);
  acc.net -= acc.remiseGlobale;
  return acc;
}
