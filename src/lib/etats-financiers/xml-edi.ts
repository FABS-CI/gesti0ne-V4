// Fichier EDI XML e-impots (DGI Côte d'Ivoire), liasse système normal « NO ».
//
// Même format que la macro GenererXML du classeur DGI « télé-liasse » :
//   <EDI><informations>type, ncc, exercice</informations>
//        <champsTableauxFixes><champTableauFixe><code/><valeur/>…
//        <champsTableauxVariables/></EDI>
// Codes des champs (onglet « champs fixes » du classeur) :
//   NO_ACTIF_<réf>_1..4 : brut, amortissements, net, net N-1
//   NO_PASSIF_<réf>_1..2, NO_RESULTAT_<réf>_1..2, NO_TFT_<réf>_1..2 : N, N-1
//
// Seuls le bilan, le compte de résultat et le TFT sont exportés ; les notes
// annexes et fiches R restent à compléter sur e-impots ou dans le classeur.

import {
  LIGNES_ACTIF,
  LIGNES_PASSIF,
  LIGNES_RESULTAT,
  type EtatsFinanciers,
} from "@/lib/etats-financiers/syscohada";
import { LIGNES_TFT, type Tft } from "@/lib/etats-financiers/tft";

export type EtatsPourXml = Pick<EtatsFinanciers, "actif" | "passif" | "resultat"> & { tft: Tft };

/** NCC au format DGI : 7 chiffres et une lettre, sans espace (ex. 2302562N). */
export function normaliserNcc(ncc: string): string {
  return ncc.replace(/\s+/g, "").toUpperCase();
}
export const nccValide = (ncc: string) => /^\d{7}[A-Z]$/.test(normaliserNcc(ncc));

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const valeur = (n: number | undefined) => String(Math.round(n ?? 0) || 0);

export function champsEdi(
  n: EtatsPourXml,
  n1?: EtatsPourXml,
): Array<[code: string, valeur: string]> {
  const champs: Array<[string, string]> = [];
  for (const l of LIGNES_ACTIF) {
    const a = n.actif[l.ref];
    champs.push(
      [`NO_ACTIF_${l.ref}_1`, valeur(a?.brut)],
      [`NO_ACTIF_${l.ref}_2`, valeur(a?.amort)],
      [`NO_ACTIF_${l.ref}_3`, valeur(a?.net)],
      [`NO_ACTIF_${l.ref}_4`, valeur(n1?.actif[l.ref]?.net)],
    );
  }
  // « dont placement net » des terrains (1) et bâtiments (2) : non suivi en comptabilité.
  for (const i of [1, 2]) champs.push([`NO_ACTIF_${i}_3`, "0"], [`NO_ACTIF_${i}_4`, "0"]);
  const deuxColonnes = (
    table: string,
    refs: string[],
    v: (ef?: EtatsPourXml) => Record<string, number> | undefined,
  ) => {
    for (const ref of refs)
      champs.push(
        [`NO_${table}_${ref}_1`, valeur(v(n)?.[ref])],
        [`NO_${table}_${ref}_2`, valeur(v(n1)?.[ref])],
      );
  };
  deuxColonnes(
    "PASSIF",
    LIGNES_PASSIF.map((l) => l.ref),
    (ef) => ef?.passif,
  );
  deuxColonnes(
    "RESULTAT",
    LIGNES_RESULTAT.map((l) => l.ref),
    (ef) => ef?.resultat,
  );
  deuxColonnes(
    "TFT",
    LIGNES_TFT.map((l) => l.ref),
    (ef) => ef?.tft.valeurs,
  );
  // Ligne sans référence du TFT : variation du BF lié aux activités opérationnelles.
  const bfr = (ef?: EtatsPourXml) =>
    ef ? ["FB", "FC", "FD", "FE"].reduce((s, r) => s + (ef.tft.valeurs[r] ?? 0), 0) : 0;
  champs.push(["NO_TFT_2_1", valeur(bfr(n))], ["NO_TFT_2_2", valeur(bfr(n1))]);
  return champs;
}

export function genererXmlEdi(opts: {
  ncc: string;
  exercice: string;
  n: EtatsPourXml;
  n1?: EtatsPourXml;
}): string {
  const champs = champsEdi(opts.n, opts.n1)
    .map(
      ([code, v]) =>
        `\t\t<champTableauFixe>\n\t\t\t<code>${code}</code>\n\t\t\t<valeur>${echapper(v)}</valeur>\n\t\t</champTableauFixe>`,
    )
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<EDI>`,
    `\t<informations>`,
    `\t\t<type>NO</type>`,
    `\t\t<ncc>${echapper(normaliserNcc(opts.ncc))}</ncc>`,
    `\t\t<exercice>${echapper(opts.exercice)}</exercice>`,
    `\t</informations>`,
    `\t<champsTableauxFixes>`,
    champs,
    `\t</champsTableauxFixes>`,
    `\t<champsTableauxVariables/>`,
    `</EDI>`,
    ``,
  ].join("\n");
}

/** Nom de fichier de la macro DGI : NO-<exercice>-<ncc>-<jjmmaaaa-hhmmss>.xml */
export function nomFichierEdi(ncc: string, exercice: string, date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  const horodatage =
    `${p(date.getDate())}${p(date.getMonth() + 1)}${date.getFullYear()}-` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `NO-${exercice}-${normaliserNcc(ncc)}-${horodatage}.xml`;
}
