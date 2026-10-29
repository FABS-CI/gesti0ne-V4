// Contrôles des états financiers d'un exercice, classés par gravité :
//   bloquant      : le dossier ne doit pas être déposé tel quel ;
//   avertissement : à vérifier et confirmer avant dépôt ;
//   info          : renseignement sur les données utilisées.

import { formatFCFA } from "@/lib/format";
import type { EtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import type { Tft } from "@/lib/etats-financiers/tft";
import type { DonneesExercice } from "@/lib/etats-financiers/sources";
import { champsManquants, type ValeurIdentite } from "@/lib/etats-financiers/identite";

export type Niveau = "bloquant" | "avertissement" | "info";
export type Controle = { niveau: Niveau; code: string; message: string };

/** Résultat de la RPC etats_financiers_completude (données de l'ERP sur la période). */
export type Completude = {
  ecritures_periode: number;
  ecritures_avant: number;
  ecritures_sans_exercice: number;
  ecritures_a_nouveaux: number;
  ecritures_desequilibrees: number;
  factures_non_comptabilisees: number;
  factures_non_comptabilisees_montant: number;
  bulletins_valides: number;
  paie_brut: number;
};

export type Periode = { date_debut: string; date_fin: string };

export type EntreeControles = {
  exercice: Periode;
  exerciceN1?: Periode | null;
  donnees: DonneesExercice;
  ef: EtatsFinanciers;
  tft: Tft;
  /** Bilan calculé sur les soldes d'ouverture. */
  ouverture: EtatsFinanciers;
  /** États de l'exercice précédent, s'il est disponible. */
  efN1?: EtatsFinanciers | null;
  completude?: Completude | null;
  identite: Record<string, ValeurIdentite>;
};

/** Nombre de mois entre deux dates ISO, arrondi (exercice du 01/01 au 31/12 : 12). */
export function dureeMois(debut: string, fin: string): number {
  const d = new Date(`${debut.slice(0, 10)}T00:00:00Z`);
  const f = new Date(`${fin.slice(0, 10)}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + 1);
  return Math.round(
    (f.getUTCFullYear() - d.getUTCFullYear()) * 12 +
      (f.getUTCMonth() - d.getUTCMonth()) +
      (f.getUTCDate() - d.getUTCDate()) / 30,
  );
}

const ORDRE: Record<Niveau, number> = { bloquant: 0, avertissement: 1, info: 2 };

export function controler(e: EntreeControles): Controle[] {
  const out: Controle[] = [];
  const add = (niveau: Niveau, code: string, message: string) =>
    out.push({ niveau, code, message });
  const { ef, tft, donnees, completude: c } = e;
  const r = ef.resultat;

  // ─── Exercice et sources ───────────────────────────────────────────────────
  if (e.exercice.date_fin < e.exercice.date_debut)
    add("bloquant", "dates", "La date de clôture de l'exercice précède sa date de début.");
  else {
    const mois = dureeMois(e.exercice.date_debut, e.exercice.date_fin);
    if (mois !== 12)
      add(
        "avertissement",
        "duree",
        `Exercice de ${mois} mois : vérifier que cette durée est voulue (premier exercice, changement de date de clôture).`,
      );
  }
  if (donnees.source === "aucune") {
    add(
      "bloquant",
      "aucune_donnee",
      "Aucune donnée comptable : ni écriture dans l'ERP sur la période, ni balance importée pour cet exercice.",
    );
    return out;
  }
  if (donnees.source === "erp") add("info", "source", "Source : écritures comptables de l'ERP.");
  else
    add("info", "source", "Source : balance importée (aucune écriture dans l'ERP sur la période).");
  if (donnees.importIgnore)
    add(
      "info",
      "import_ignore",
      "Une balance importée existe pour cet exercice ; elle est ignorée car l'ERP contient des écritures.",
    );
  if (donnees.ouvertureImportee)
    add(
      "info",
      "ouverture_importee",
      "Soldes d'ouverture repris de la balance importée de l'exercice précédent.",
    );
  if (!donnees.ouvertureConnue)
    add(
      "avertissement",
      "ouverture_inconnue",
      donnees.source === "erp"
        ? "Aucun solde d'ouverture : premier exercice dans l'ERP. Si l'entreprise existait avant, importer la balance de clôture de l'exercice précédent."
        : "Soldes d'ouverture inconnus : importer la balance N-1 ou une balance à 6 colonnes, sinon le TFT est faux.",
    );
  if (!donnees.mouvementsConnus)
    add(
      "avertissement",
      "tft_approx",
      "La balance importée ne contient pas les mouvements de l'exercice : acquisitions, emprunts et remboursements du TFT ne sont pas fiables.",
    );

  // ─── Équilibres ────────────────────────────────────────────────────────────
  if (ef.controles.ecartBilan)
    add(
      "bloquant",
      "bilan",
      `Bilan déséquilibré : actif − passif = ${formatFCFA(ef.controles.ecartBilan)}.`,
    );
  if (ef.comptesNonClasses.length)
    add(
      "bloquant",
      "comptes_non_classes",
      `Comptes sans poste dans la correspondance SYSCOHADA : ${ef.comptesNonClasses.map((x) => `${x.compte} (${formatFCFA(x.solde)})`).join(", ")}.`,
    );
  if (tft.ecartTresorerie && donnees.ouvertureConnue)
    add(
      "bloquant",
      "tft",
      `TFT : la trésorerie de clôture calculée diffère du bilan de ${formatFCFA(tft.ecartTresorerie)}.`,
    );
  if (ef.controles.ecartResultat)
    add(
      "avertissement",
      "resultat",
      `Le résultat au bilan diffère du compte de résultat de ${formatFCFA(ef.controles.ecartResultat)} (compte 13 mouvementé ?).`,
    );
  if (ef.resultatAnterieurNonAffecte)
    add(
      "avertissement",
      "affectation",
      `${formatFCFA(ef.resultatAnterieurNonAffecte)} de résultats antérieurs présentés en report à nouveau : l'ERP ne comptabilise pas l'affectation du résultat. Si une partie a été distribuée ou mise en réserve, passer l'écriture d'affectation.`,
    );

  // ─── Exhaustivité des écritures (ERP) ──────────────────────────────────────
  if (c) {
    if (c.ecritures_desequilibrees)
      add(
        "bloquant",
        "ecritures_desequilibrees",
        `${c.ecritures_desequilibrees} écriture(s) de la période déséquilibrée(s) (débit ≠ crédit).`,
      );
    if (c.factures_non_comptabilisees)
      add(
        "avertissement",
        "factures",
        `${c.factures_non_comptabilisees} facture(s) de la période sans écriture comptable (${formatFCFA(c.factures_non_comptabilisees_montant)}).`,
      );
    const personnel = -(r.RK ?? 0);
    if (c.bulletins_valides && personnel < c.paie_brut * 0.5)
      add(
        "avertissement",
        "paie",
        `Paie non comptabilisée : ${c.bulletins_valides} bulletin(s) validé(s), brut ${formatFCFA(c.paie_brut)}, charges de personnel en comptabilité ${formatFCFA(personnel)}. L'ERP ne génère pas les écritures de paie : passer l'OD de salaires.`,
      );
    if (c.ecritures_a_nouveaux)
      add(
        "avertissement",
        "a_nouveaux",
        `${c.ecritures_a_nouveaux} écriture(s) d'à-nouveaux (journal AN) dans la période : l'ERP cumule déjà les soldes antérieurs, risque de double comptage.`,
      );
    if (c.ecritures_sans_exercice)
      add(
        "info",
        "sans_exercice",
        `${c.ecritures_sans_exercice} écriture(s) de la période sans exercice rattaché (prises en compte d'après leur date).`,
      );
  }

  // ─── Opérations d'inventaire ───────────────────────────────────────────────
  const immoAmortissables = (ef.actif.AD?.brut ?? 0) + (ef.actif.AI?.brut ?? 0);
  if (immoAmortissables > 0 && !(r.RL ?? 0))
    add(
      "avertissement",
      "amortissements",
      `Immobilisations de ${formatFCFA(immoAmortissables)} sans dotation aux amortissements dans l'exercice (681). L'ERP n'a pas de registre des immobilisations : passer l'écriture de dotation.`,
    );
  if (!(r.RS ?? 0))
    add(
      "avertissement",
      "impot",
      "Aucun impôt sur le résultat comptabilisé (89) : l'IS ou l'impôt minimum forfaitaire est dû même en cas de perte.",
    );
  if (!(ef.actif.BB?.brut ?? 0))
    add(
      "info",
      "stocks",
      "Aucun stock en comptabilité (classe 3) : si l'entreprise détient des stocks à la clôture, passer l'écriture d'inventaire (31 / 6031). Le module Stocks ne la génère pas.",
    );
  const ventes = donnees.periode
    .filter((x) => x.compte.startsWith("70"))
    .reduce((s, x) => s - x.solde, 0);
  const tvaCollectee = donnees.periode
    .filter((x) => x.compte.startsWith("443"))
    .reduce((s, x) => s + x.credit, 0);
  if (ventes > 0 && !tvaCollectee)
    add(
      "info",
      "tva",
      "Aucune TVA collectée (443) : correct si les ventes sont exonérées (livres). Sinon les factures sont comptabilisées TTC en ventes et le chiffre d'affaires est surévalué.",
    );

  // ─── Comparatif N-1 ────────────────────────────────────────────────────────
  if (!e.efN1) add("info", "n1_absent", "Exercice précédent indisponible : colonne N-1 vide.");
  else if (donnees.ouvertureConnue) {
    const ecart = Math.round(e.ouverture.actif.BZ.net - e.efN1.actif.BZ.net);
    if (ecart)
      add(
        "avertissement",
        "continuite",
        `Le bilan d'ouverture diffère du bilan de clôture N-1 de ${formatFCFA(ecart)} (écritures modifiées sur N-1 après coup ?).`,
      );
  }

  // ─── Identification ────────────────────────────────────────────────────────
  const manquants = champsManquants(e.identite);
  if (manquants.length)
    add(
      "bloquant",
      "identite",
      `Identification incomplète : ${manquants.map((m) => m.libelle).join(", ")}.`,
    );

  return out.sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau]);
}

export type StatutPreparation = "incomplet" | "a_verifier" | "pret";

export function statutPreparation(controles: Controle[]): StatutPreparation {
  if (controles.some((c) => c.niveau === "bloquant")) return "incomplet";
  if (controles.some((c) => c.niveau === "avertissement")) return "a_verifier";
  return "pret";
}
