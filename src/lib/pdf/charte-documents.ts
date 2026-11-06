// Charte graphique des documents commerciaux FABS-CI (factures, proformas,
// bons de commande / livraison / retour, avoirs, reçus, relevés).
// SEUL endroit où ces couleurs sont définies : base-document.ts les applique.
// Le récapitulatif des montants n'est PAS couvert : il suit le thème choisi
// dans « Apparence des documents » (recap-themes.ts).
// Ne pas reprendre la palette de l'interface (bleu pétrole) dans les PDF.
import { rgb, type RGB } from "pdf-lib";

export const CHARTE_HEX = {
  titre: "#E9530D",
  enTete: "#2563EB",
  enTeteTexte: "#FFFFFF",
  zebra: "#EAF2FF",
  contour: "#173B78",
  traitInterne: "#A8BFE3",
} as const;

export type CharteKey = keyof typeof CHARTE_HEX;

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

export const CHARTE = Object.fromEntries(
  Object.entries(CHARTE_HEX).map(([k, v]) => [k, hexToRgb(v)]),
) as Record<CharteKey, RGB>;

/** Zébrage : une ligne sur deux, indice global (continu d'une page à l'autre). */
export const isZebraRow = (globalIndex: number) => globalIndex % 2 === 1;
