export function assertActiveAccount(profile: { statut: string | null; actif: boolean | null } | null) {
  if (!profile || profile.statut !== "actif" || profile.actif !== true) {
    throw new Error("Accès refusé : compte inactif");
  }
}