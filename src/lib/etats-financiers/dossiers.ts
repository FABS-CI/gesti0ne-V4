// Dossier annuel figé : chaque génération enregistre une version (états, contrôles,
// identification, données utilisées). Un dossier validé est affiché tel qu'il a
// été validé, même si les écritures changent ensuite ; l'écart est signalé grâce
// à l'empreinte des données calculée en base (etats_financiers_empreinte).

import type { EtatsExercice } from "@/lib/etats-financiers/donnees-api";
import {
  statutPreparation,
  type Controle,
  type Periode,
  type StatutPreparation,
} from "@/lib/etats-financiers/controles";
import type { ValeurIdentite } from "@/lib/etats-financiers/identite";

/** Modèle de liasse reproduit (classeur DGI 2025, système normal). */
export const VERSION_MODELE = "SYSCOHADA révisé — liasse DGI 2025 (système normal)";
/** Règles de correspondance comptes → postes, écrites dans syscohada.ts, tft.ts et notes.ts. */
export const VERSION_REGLES = "syscohada-2017.1";
/** Format du contenu enregistré : à incrémenter si sa structure change. */
export const FORMAT_CONTENU = 1;

export type StatutDossier = "brouillon" | "remplace" | "valide" | "devalide";

/** États figés : la balance importée n'est gardée que par sa référence (lignes déjà dans donnees). */
export type EtatsFiges = Omit<EtatsExercice, "balanceImportee"> & {
  balanceImportee: { lotId: string; fichier: string | null; importeLe: string } | null;
};

export type ContenuDossier = {
  format: number;
  exercice: Periode & { exercice_id: string; libelle: string };
  exerciceN1: (Periode & { exercice_id: string; libelle: string }) | null;
  n: EtatsFiges;
  n1: EtatsFiges | null;
  controles: Controle[];
  identite: Record<string, ValeurIdentite>;
};

/** Ligne de l'historique (RPC etats_financiers_historique). */
export type VersionDossier = {
  dossier_id: string;
  version: number;
  statut: StatutDossier;
  preparation: StatutPreparation;
  nb_bloquants: number;
  nb_avertissements: number;
  source: string;
  version_modele: string;
  version_regles: string;
  empreinte: string;
  genere_le: string;
  genere_par_nom: string | null;
  valide_le: string | null;
  valide_par_nom: string | null;
  commentaire_validation: string | null;
  devalide_le: string | null;
  devalide_par_nom: string | null;
  motif_devalidation: string | null;
};

export function figerEtats(e: EtatsExercice): EtatsFiges {
  const b = e.balanceImportee;
  return {
    ...e,
    balanceImportee: b ? { lotId: b.lotId, fichier: b.fichier, importeLe: b.importeLe } : null,
  };
}

type Exo = Periode & { exercice_id: string };

export function construireContenu(p: {
  exercice: Exo;
  exerciceN1: Exo | null;
  libelle: (e: Exo) => string;
  n: EtatsExercice;
  n1: EtatsExercice | null | undefined;
  controles: Controle[];
  identite: Record<string, ValeurIdentite>;
}): ContenuDossier {
  const exo = (e: Exo) => ({
    exercice_id: e.exercice_id,
    date_debut: e.date_debut,
    date_fin: e.date_fin,
    libelle: p.libelle(e),
  });
  return {
    format: FORMAT_CONTENU,
    exercice: exo(p.exercice),
    exerciceN1: p.exerciceN1 ? exo(p.exerciceN1) : null,
    n: figerEtats(p.n),
    n1: p.n1 ? figerEtats(p.n1) : null,
    controles: p.controles,
    identite: p.identite,
  };
}

/** Paramètres de la RPC etats_financiers_enregistrer_dossier. */
export function parametresEnregistrement(c: ContenuDossier) {
  const compte = (niveau: Controle["niveau"]) =>
    c.controles.filter((x) => x.niveau === niveau).length;
  return {
    p_exercice_id: c.exercice.exercice_id,
    p_preparation: statutPreparation(c.controles),
    p_nb_bloquants: compte("bloquant"),
    p_nb_avertissements: compte("avertissement"),
    p_source: c.n.donnees.source,
    p_version_modele: VERSION_MODELE,
    p_version_regles: VERSION_REGLES,
    p_contenu: c,
  };
}

/** Version en vigueur : la validée, sinon le dernier brouillon. */
export function versionEnVigueur(versions: VersionDossier[]): VersionDossier | null {
  return (
    versions.find((v) => v.statut === "valide") ??
    versions.find((v) => v.statut === "brouillon") ??
    null
  );
}

export type EtatDossier =
  | { etape: "aucun" }
  | { etape: "brouillon"; version: VersionDossier; aJour: boolean | null }
  | { etape: "valide"; version: VersionDossier; aJour: boolean | null };

/**
 * Situation du dossier d'un exercice. aJour : l'empreinte actuelle des données est
 * celle de la version (null si l'empreinte actuelle n'a pas pu être lue).
 */
export function etatDossier(
  versions: VersionDossier[],
  empreinteActuelle: string | null,
): EtatDossier {
  const v = versionEnVigueur(versions);
  if (!v) return { etape: "aucun" };
  const aJour = empreinteActuelle == null ? null : empreinteActuelle === v.empreinte;
  return { etape: v.statut === "valide" ? "valide" : "brouillon", version: v, aJour };
}

/** Raisons pour lesquelles la validation est impossible (vide : validable). */
export function obstaclesValidation(etat: EtatDossier): string[] {
  if (etat.etape === "aucun") return ["Aucun dossier généré."];
  if (etat.etape === "valide") return ["Le dossier est déjà validé."];
  const out: string[] = [];
  if (etat.version.nb_bloquants > 0 || etat.version.preparation === "incomplet")
    out.push(`${etat.version.nb_bloquants} contrôle(s) bloquant(s) à corriger.`);
  if (etat.aJour === false)
    out.push("Les données comptables ont changé depuis la génération : régénérer le dossier.");
  return out;
}
