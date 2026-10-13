/**
 * Conversion de nombres en lettres (FCFA) pour les documents commerciaux.
 * Règles françaises (orthographe de 1990, traits d'union) :
 * - « vingt » et « cent » prennent un « s » quand ils sont multipliés et non
 *   suivis d'un autre nombre ; « million » et « milliard » sont des noms et
 *   n'empêchent pas ce pluriel (« deux cents millions ») ; « mille » l'empêche.
 * - « mille » est invariable.
 * - « un million de francs CFA » quand rien ne suit million/milliard.
 * - « franc » au singulier pour 0 et 1.
 */

const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
const DIX_A_DIX_NEUF = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** Convertit 1..999. `pluriel` : le groupe peut porter le « s » final (vingts/cents). */
function convertirGroupe(n: number, pluriel: boolean): string {
  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const du = n % 100;

  if (c > 0) {
    if (c === 1) parts.push("cent");
    else parts.push(UNITES[c] + "-cent" + (du === 0 && pluriel ? "s" : ""));
  }

  if (du > 0) {
    let s: string;
    if (du < 10) s = UNITES[du];
    else if (du < 20) s = DIX_A_DIX_NEUF[du - 10];
    else {
      const d = Math.floor(du / 10);
      const u = du % 10;
      if (d === 7) s = "soixante-" + (u === 1 ? "et-onze" : DIX_A_DIX_NEUF[u]);
      else if (d === 8) s = u === 0 ? "quatre-vingt" + (pluriel ? "s" : "") : "quatre-vingt-" + UNITES[u];
      else if (d === 9) s = "quatre-vingt-" + DIX_A_DIX_NEUF[u];
      else s = DIZAINES[d] + (u === 0 ? "" : u === 1 ? "-et-un" : "-" + UNITES[u]);
    }
    parts.push(s);
  }
  return parts.join("-");
}

export function numberToLetters(n: number): string {
  const rounded = Math.round(Math.abs(Number(n) || 0));
  const negatif = Number(n) < 0 && rounded > 0;

  let words: string;
  let de = false;
  if (rounded === 0) words = "zéro";
  else {
    const milliards = Math.floor(rounded / 1_000_000_000);
    const millions = Math.floor((rounded % 1_000_000_000) / 1_000_000);
    const milliers = Math.floor((rounded % 1_000_000) / 1_000);
    const reste = rounded % 1_000;
    const parts: string[] = [];
    if (milliards > 0) {
      parts.push(convertirGroupe(milliards, true) + " milliard" + (milliards > 1 ? "s" : ""));
      if (millions === 0 && milliers === 0 && reste === 0) de = true;
    }
    if (millions > 0) {
      parts.push(convertirGroupe(millions, true) + " million" + (millions > 1 ? "s" : ""));
      if (milliers === 0 && reste === 0) de = true;
    }
    if (milliers > 0) parts.push(milliers === 1 ? "mille" : convertirGroupe(milliers, false) + "-mille");
    if (reste > 0) parts.push(convertirGroupe(reste, true));
    words = parts.join(" ");
  }

  const franc = rounded <= 1 ? "franc" : "francs";
  const text = (negatif ? "moins " : "") + words + (de ? " de " : " ") + franc + " CFA";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
