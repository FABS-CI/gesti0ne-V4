// Qui la génération mensuelle propose-t-elle ? Un salarié sorti, suspendu, pas encore
// embauché ou dont le contrat est terminé n'est pas ajouté automatiquement à la paie.
// Une régularisation reste possible bulletin par bulletin (Paie → Nouveau bulletin).
//
// La fiche porte `statut_employe` (enum : actif, suspendu, demission, licencie, retraite,
// fin_contrat) et `actif` ; l'ancien filtre lisait un champ `statut` inexistant, donc
// tout le monde passait.

export type EmployeEligibilite = {
  actif?: boolean | null;
  statut_employe?: string | null;
  date_embauche?: string | null;
  date_fin_contrat?: string | null;
  deleted_at?: string | null;
};

export type Eligibilite = { eligible: true } | { eligible: false; raison: string };

const LIBELLES: Record<string, string> = {
  suspendu: "Salarié suspendu",
  demission: "Démission",
  licencie: "Licencié",
  retraite: "Retraité",
  fin_contrat: "Fin de contrat",
};

/** Dates ISO yyyy-mm-dd : la comparaison de chaînes suit l'ordre chronologique. */
export function eligibilitePaie(e: EmployeEligibilite, debut: string, fin: string): Eligibilite {
  if (e.deleted_at) return { eligible: false, raison: "Fiche archivée" };
  if (e.actif === false) return { eligible: false, raison: "Fiche inactive" };
  const statut = e.statut_employe ?? "actif";
  if (statut !== "actif")
    return { eligible: false, raison: LIBELLES[statut] ?? `Statut « ${statut} »` };
  if (e.date_embauche && e.date_embauche > fin) {
    return { eligible: false, raison: "Embauché après la période" };
  }
  if (e.date_fin_contrat && e.date_fin_contrat < debut) {
    return { eligible: false, raison: "Contrat terminé avant la période" };
  }
  return { eligible: true };
}
