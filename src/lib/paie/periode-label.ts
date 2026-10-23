/**
 * Libellé de période de paie, affiché tel quel dans les listes.
 * Les bulletins enregistrés stockent « Octobre 2026 » ; d'anciennes lignes
 * peuvent encore porter « 2026-10 » : elles sont converties à l'affichage.
 */

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function formatPeriodeLabel(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  const m = /^(\d{4})-(\d{1,2})(?:-\d{2})?$/.exec(s);
  if (m) {
    const annee = Number(m[1]);
    const mois = Number(m[2]);
    if (mois >= 1 && mois <= 12) return `${MOIS[mois - 1]} ${annee}`;
  }
  return s;
}
