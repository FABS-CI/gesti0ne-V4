import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";
import {
  champsEdi,
  genererXmlEdi,
  nccValide,
  nomFichierEdi,
  normaliserNcc,
} from "@/lib/etats-financiers/xml-edi";
// Codes des champs ACTIF, PASSIF, RESULTAT et TFT de l'onglet « champs fixes »
// du classeur DGI télé-liasse 2025 (système normal).
import CODES_DGI from "@/lib/etats-financiers/codes-edi-dgi.json";

const ligne = (compte: string, solde: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

const OUVERTURE = [ligne("1013", -10_000_000), ligne("5211", 10_000_000)];
const PERIODE = [
  ligne("7011", -515_053_551),
  ligne("6011", 410_742_724),
  ligne("5211", 104_310_827),
];
const CUMUL = [
  ligne("1013", -10_000_000),
  ligne("5211", 114_310_827),
  ligne("7011", -515_053_551),
  ligne("6011", 410_742_724),
];

const ouverture = calculerEtatsFinanciers(OUVERTURE, []);
const cloture = calculerEtatsFinanciers(CUMUL, PERIODE);
const n = { ...cloture, tft: calculerTft(ouverture, cloture, PERIODE) };

describe("export EDI XML e-impots", () => {
  it("produit exactement les champs du classeur DGI", () => {
    const codes = champsEdi(n).map(([c]) => c);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...CODES_DGI].sort());
  });

  it("reprend les montants calculés", () => {
    const champs = new Map(champsEdi(n, n));
    expect(champs.get("NO_RESULTAT_TA_1")).toBe("515053551");
    expect(champs.get("NO_RESULTAT_RA_1")).toBe("-410742724");
    expect(champs.get("NO_RESULTAT_XI_1")).toBe("104310827");
    expect(champs.get("NO_RESULTAT_XI_2")).toBe("104310827");
    expect(champs.get("NO_ACTIF_BS_3")).toBe("114310827");
    expect(champs.get("NO_PASSIF_DZ_1")).toBe("114310827");
    expect(champs.get("NO_TFT_ZG_1")).toBe("104310827");
    expect(champs.get("NO_ACTIF_AD_4")).toBe("0");
  });

  it("N-1 absent : colonnes N-1 à zéro", () => {
    const champs = new Map(champsEdi(n));
    expect(champs.get("NO_ACTIF_BS_4")).toBe("0");
    expect(champs.get("NO_RESULTAT_XI_2")).toBe("0");
  });

  it("en-tête et structure du fichier", () => {
    const xml = genererXmlEdi({ ncc: "2302562 n", exercice: "2025", n });
    expect(xml).toContain("<type>NO</type>");
    expect(xml).toContain("<ncc>2302562N</ncc>");
    expect(xml).toContain("<exercice>2025</exercice>");
    expect(xml).toContain(
      "<champTableauFixe>\n\t\t\t<code>NO_RESULTAT_TA_1</code>\n\t\t\t<valeur>515053551</valeur>",
    );
    expect(xml.trim().endsWith("</EDI>")).toBe(true);
  });

  it("NCC : espace retiré, format 1234567A contrôlé", () => {
    expect(normaliserNcc(" 2302562 N ")).toBe("2302562N");
    expect(nccValide("2302562 N")).toBe(true);
    expect(nccValide("230256N")).toBe(false);
  });

  it("nom de fichier de la macro DGI", () => {
    expect(nomFichierEdi("2302562 N", "2025", new Date(2026, 3, 30, 9, 5, 7))).toBe(
      "NO-2025-2302562N-30042026-090507.xml",
    );
  });
});
