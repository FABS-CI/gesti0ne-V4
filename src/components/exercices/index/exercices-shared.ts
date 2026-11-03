import type { ExerciceStatut } from "@/contexts/ExerciceContext";

export const STATUT_LABEL: Record<ExerciceStatut, string> = {
  preparation: "Préparation",
  actif: "Actif",
  cloture_en_cours: "Clôture en cours",
  cloture: "Clôturé",
  archive: "Archivé",
};

// Aperçu de clôture (RPC preview_cloture_exercice, migration 0112).
export type PreviewResult = {
  exercice: {
    exercice_id: string;
    code: string;
    date_debut: string;
    date_fin: string;
    statut: string;
  };
  /** Exercice qui commence le lendemain ; a_creer : il sera créé par la clôture. */
  exercice_suivant: { exercice_id: string | null; code: string; a_creer: boolean } | null;
  comptes: {
    nb_ecritures: number;
    total_debit: number;
    total_credit: number;
    produits: number;
    charges: number;
    resultat: number;
  };
  blocages: { code: string; severite: "warning" | "error"; nombre: number; message: string }[];
  peut_cloturer: boolean;
};

export type EditingExercice = {
  exercice_id: string;
  code: string;
  date_debut: string;
  date_fin: string;
  statut: ExerciceStatut;
};
