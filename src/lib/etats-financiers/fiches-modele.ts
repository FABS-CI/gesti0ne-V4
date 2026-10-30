// Fiches R1, R2 et R4 du modèle de liasse DGI 2025 : cellules remplies par l'export.
//
// R1 : l'identification saisie dans l'ERP remplace celle du modèle ; un champ vide
// dans l'ERP laisse la valeur du modèle (informations permanentes), signalée à
// vérifier. Les renseignements propres à l'exercice (dates, arrêté des comptes,
// approbation, signature) sont mis à jour ou vidés, jamais repris d'une autre année.
// R2 : chiffre d'affaires de l'activité principale. R3 (dirigeants) : non modifiée.
// R4 : notes applicables (A) ou non (N/A), pour les notes calculées par l'ERP.

export type ChampFiche =
  | { cellule: string; identite: string; libelle: string }
  | { cellule: string; exercice: "debut" | "fin" | "fin_n1" | "duree_n1"; libelle: string }
  | { cellule: string; vider: true; libelle: string };

export const FICHE_R1_2025: { feuille: string; champs: ChampFiche[] } = {
  feuille: "FICHE R1",
  champs: [
    { cellule: "N8", exercice: "debut", libelle: "Début de l'exercice (ZA)" },
    { cellule: "S8", exercice: "fin", libelle: "Fin de l'exercice (ZA)" },
    { cellule: "H10", vider: true, libelle: "Date d'arrêté effectif des comptes (ZB)" },
    { cellule: "H12", exercice: "fin_n1", libelle: "Exercice précédent clos le (ZC)" },
    { cellule: "U12", exercice: "duree_n1", libelle: "Durée de l'exercice précédent (ZC)" },
    { cellule: "D14", identite: "rccm", libelle: "N° Registre du commerce (ZE)" },
    { cellule: "C17", identite: "caisse_sociale", libelle: "N° de caisse sociale (ZG)" },
    { cellule: "F17", identite: "code_importateur", libelle: "N° code importateur (ZH)" },
    { cellule: "Q17", identite: "code_activite", libelle: "Code activité principale (ZI)" },
    { cellule: "C20", identite: "denomination", libelle: "Désignation de l'entité (ZJ)" },
    { cellule: "Q20", identite: "sigle", libelle: "Sigle (ZJ)" },
    { cellule: "C23", identite: "telephone", libelle: "Téléphone (ZK)" },
    { cellule: "E23", identite: "email", libelle: "Adresse e-mail (ZK)" },
    { cellule: "C26", identite: "adresse_geographique", libelle: "Adresse géographique (ZL)" },
    { cellule: "C29", identite: "activite", libelle: "Activité principale (ZM)" },
    { cellule: "C39", identite: "expert_comptable", libelle: "Expert-comptable, visa (ZQ)" },
    { cellule: "Q47", vider: true, libelle: "États financiers approuvés par l'AG (ZS)" },
    { cellule: "C50", identite: "signataire_nom", libelle: "Signataire des états financiers (ZT)" },
    { cellule: "C53", identite: "signataire_qualite", libelle: "Qualité du signataire (ZU)" },
    { cellule: "C56", vider: true, libelle: "Date de signature (ZV)" },
  ],
};

/** R2 : chiffre d'affaires HT de la première activité (ligne 28, colonne Y). */
export const FICHE_R2_2025 = {
  feuille: "FICHE R2",
  libelleActivite: "A28",
  chiffreAffaires: "Y28",
};

/** R4 : une ligne par note (« NOTE 3C bis »…), X en colonne I (applicable) ou J (N/A). */
export const FICHE_R4_2025 = { feuille: "FICHE R4", applicable: "I", nonApplicable: "J" };

/** Date ISO → numéro de série Excel (jours depuis le 30/12/1899). */
export function serieExcel(iso: string): number {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, j) - Date.UTC(1899, 11, 30)) / 86_400_000);
}
