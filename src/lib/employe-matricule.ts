/** Matricules employés : EP-01, EP-02 … EP-100 (attribués uniquement par la base). */
export const EMPLOYE_MATRICULE_RE = /^EP-\d{2,}$/;

export function isEmployeMatricule(value: string | null | undefined): boolean {
  return !!value && EMPLOYE_MATRICULE_RE.test(value);
}

/** Retire le matricule d'un envoi : la base l'attribue et il ne se modifie pas à la main. */
export function withoutMatricule<T extends { matricule?: unknown }>(input: T): Omit<T, "matricule"> {
  const { matricule: _ignored, ...rest } = input;
  return rest;
}

export function employeCreeMessage(matricule: string | null | undefined): string {
  return isEmployeMatricule(matricule) ? `Employé créé — matricule ${matricule}` : "Employé créé";
}
