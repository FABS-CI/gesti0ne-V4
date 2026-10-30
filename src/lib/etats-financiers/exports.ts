// Données communes aux exports du dossier (PDF, Excel) : les états affichés, la
// version enregistrée consultée, sinon les données actuelles.

import type { EtatsPourPdf, Section } from "@/lib/etats-financiers/dossier-pdf";
import type { Controle } from "@/lib/etats-financiers/controles";
import type { ValeurIdentite } from "@/lib/etats-financiers/identite";

export type DonneesExport = {
  n: EtatsPourPdf;
  n1?: EtatsPourPdf;
  exercice: { date_debut: string; date_fin: string; libelle: string };
  exerciceN1: { libelle: string } | null;
  identite: Record<string, ValeurIdentite>;
  controles: Controle[];
  /** Version du dossier exportée ; absent : données actuelles non enregistrées. */
  version?: string;
};

export const identiteExport = (i: Record<string, ValeurIdentite>) => ({
  denomination: i.denomination?.valeur,
  sigle: i.sigle?.valeur,
  adresse: i.adresse?.valeur,
  ncc: i.ncc?.valeur,
  ntd: i.ntd?.valeur,
});

export const anneeExport = (d: DonneesExport) => d.exercice.date_fin.slice(0, 4);

/** Dossier PDF complet, ou un seul état. */
export async function exporterPdf(d: DonneesExport, section?: Section) {
  const { genererDossierPdf, nomFichierPdf } = await import("@/lib/etats-financiers/dossier-pdf");
  const doc = genererDossierPdf(
    {
      n: d.n,
      n1: d.n1,
      exercice: d.exercice,
      exerciceN1: d.exerciceN1,
      identite: identiteExport(d.identite),
      controles: d.controles,
      version: d.version,
    },
    section ? [section] : undefined,
  );
  doc.save(nomFichierPdf(anneeExport(d), section));
}
