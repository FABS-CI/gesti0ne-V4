// Charte graphique des documents commerciaux FABS-CI (décision du 05/11/2026).
// Purement visuelle : aucun montant, aucune référence, aucun QR n'en dépend.
// Une seule source pour les couleurs et les épaisseurs de traits de tous les PDF
// dessinés par base-document.ts (factures, proformas, BC, BL, avoirs, retours,
// reçus, relevés…).
import { rgb, type RGB } from "pdf-lib";

export const CHARTE_HEX = {
  /** Orange du logo officiel FABS-CI (mesuré sur src/assets/fabs-logo.png). */
  orange: "#E9530D",
  /** Bleu électrique : en-têtes de tableaux, bandeaux de sections, TOTAL À PAYER. */
  bleu: "#2563EB",
  /** Zébrage des lignes de tableau (une ligne sur deux). */
  zebre: "#EAF2FF",
  /** Bordure extérieure des tableaux et des blocs. */
  bordureExterieure: "#173B78",
  /** Traits internes (séparateurs de lignes et de colonnes). */
  traitInterne: "#A8BFE3",
  /** Fond de la ligne MONTANT PAYÉ. */
  grisPaye: "#F3F4F6",
  blanc: "#FFFFFF",
} as const;

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

export const CHARTE = {
  orange: hexToRgb(CHARTE_HEX.orange),
  bleu: hexToRgb(CHARTE_HEX.bleu),
  zebre: hexToRgb(CHARTE_HEX.zebre),
  bordureExterieure: hexToRgb(CHARTE_HEX.bordureExterieure),
  traitInterne: hexToRgb(CHARTE_HEX.traitInterne),
  grisPaye: hexToRgb(CHARTE_HEX.grisPaye),
  blanc: hexToRgb(CHARTE_HEX.blanc),
  /** Épaisseurs en points PDF (1 pt = 1,33 px) : extérieur ≈ 1,1 px, interne ≈ 0,8 px. */
  epaisseurExterieure: 0.85,
  epaisseurInterne: 0.6,
  /** Hauteur des bandeaux bleus de section (texte blanc). */
  hauteurBandeau: 14,
};
