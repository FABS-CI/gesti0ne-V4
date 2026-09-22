import { z } from "zod";

export const paiementSchema = z.object({
  montant: z.number().positive("Le montant reçu doit être supérieur à 0"),
  mode_paiement: z.string().min(1, "Le mode de paiement est requis"),
  reference_paiement: z
    .string()
    .trim()
    .min(1, "La référence du paiement est obligatoire")
    .max(80, "Référence trop longue"),
});

export type PaiementFormInput = z.infer<typeof paiementSchema>;

export type RecapLine = {
  reference: string;
  reste_avant: number;
  montant_impute: number;
  reste_apres: number;
};

export type FactureARepartir = {
  facture_id: string;
  solde: number | string;
};

/**
 * Répartit le montant réellement reçu sur les factures sélectionnées, dans
 * leur ordre d'affichage, sans jamais dépasser le solde de chaque facture.
 */
export function repartirMontantRecu(
  montantRecu: number,
  factures: FactureARepartir[],
): Record<string, number> {
  let restant = Math.max(0, Number(montantRecu) || 0);

  return Object.fromEntries(
    factures.map((facture) => {
      const solde = Math.max(0, Number(facture.solde) || 0);
      const montant = Math.min(solde, restant);
      restant = Math.max(0, restant - montant);
      return [facture.facture_id, montant];
    }),
  );
}

/** Répartit un montant reçu sur une facture donnée. Un paiement ne peut jamais
 *  imputer plus que le solde restant. */
export function computeRecap(
  factureRef: string,
  soldeAvant: number,
  montantRecu: number,
): RecapLine {
  const impute = Math.max(0, Math.min(soldeAvant, montantRecu));
  return {
    reference: factureRef,
    reste_avant: soldeAvant,
    montant_impute: impute,
    reste_apres: Math.max(0, soldeAvant - impute),
  };
}

export function validatePaiement(input: {
  montant: number;
  mode_paiement: string;
  reference_paiement: string;
  solde?: number;
}): { ok: true } | { ok: false; message: string } {
  const parsed = paiementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (input.solde !== undefined && input.montant > input.solde) {
    return { ok: false, message: "Le montant dépasse le solde dû de la facture" };
  }
  return { ok: true };
}

export const COMPARATIF_LS_KEY = "exercices-comparatif-state-v1";

export type ComparatifPersistedState = {
  exos?: string;
  sort?: "code" | "ca" | "encaisse" | "achats" | "resultat";
  dir?: "asc" | "desc";
  pct?: boolean;
};

export function saveComparatifState(
  storage: Pick<Storage, "setItem">,
  state: ComparatifPersistedState,
) {
  try {
    storage.setItem(COMPARATIF_LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadComparatifState(
  storage: Pick<Storage, "getItem">,
): ComparatifPersistedState | null {
  try {
    const raw = storage.getItem(COMPARATIF_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ComparatifPersistedState;
  } catch {
    return null;
  }
}
