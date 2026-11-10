// Statuts d'achat comptés dans les rapports d'exercice (même règle que la RPC
// du comparatif) : seuls les achats reçus ou payés pèsent dans les totaux.
export const STATUTS_ACHAT_COMPTABILISES = ["recu", "paye"] as const;

export function estAchatComptabilise(statut: string | null | undefined): boolean {
  return (STATUTS_ACHAT_COMPTABILISES as readonly string[]).includes(statut ?? "");
}

export function totalAchatsComptabilises(
  achats: ReadonlyArray<{ montant: number | string | null; statut: string | null }>,
): { nb: number; total: number } {
  const retenus = achats.filter((a) => estAchatComptabilise(a.statut));
  return {
    nb: retenus.length,
    total: retenus.reduce((s, a) => s + Number(a.montant ?? 0), 0),
  };
}
