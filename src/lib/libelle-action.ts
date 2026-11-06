/**
 * Libellé court d'un bouton d'action (interface sans icônes décoratives).
 * Le libellé complet reste dans title / aria-label ; le bouton affiche la version courte.
 *   « Supprimer définitivement »            → « Supprimer »
 *   « Télécharger la proforma (PDF) »        → « Télécharger »
 *   « Valider la commande (génère facture) » → « Valider »
 */
const COURTS: Record<string, string> = {
  "Supprimer définitivement": "Supprimer",
  "Envoyer par email": "Email",
  "Solder la facture": "Solder",
  Visualiser: "Voir",
};

export function libelleCourt(libelle: string): string {
  const sans = libelle.replace(/\s*\(.*\)\s*$/, "").trim();
  if (COURTS[sans]) return COURTS[sans];
  if (sans.length <= 14) return sans;
  return sans.split(/\s+/)[0];
}
