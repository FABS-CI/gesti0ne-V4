import { describe, expect, it } from "vitest";
import { calculerBulletin, REGIME_2024 } from "./regimes-ci";
import { construireDonneesPdf, lignesPourPdf, type BulletinStocke, type LigneStockee } from "./bulletin-pdf-data";
import { ENTREPRISE_FABS } from "@/lib/pdf/bulletinPaieCI";

const res = calculerBulletin({ salaireBase: 60000, sursalaire: 77672, tauxAnciennete: 7, transport: 30000, parts: 3 }, REGIME_2024);
const stockees: LigneStockee[] = res.lignes.map((l) => ({
  numero_rubrique: l.numero, designation: l.designation, libelle: null, nombre: l.nombre,
  base: l.base, taux: l.taux, gain: l.gain, retenue: l.retenue, bloc: l.bloc, ordre: l.ordre,
}));
const b: BulletinStocke = {
  bulletin_id: "abcdef12-0000", reference: "BP-2026-00001", employe_nom: "TEST", periode: "Août 2026",
  date_debut: "2026-08-01", date_fin: "2026-08-31", date_paiement: null, date_etablissement: null,
  created_at: "2026-08-31", mode_paiement: "Virement", parts: 3, brut_imposable: res.brutImposable,
  salaire_brut: res.brutImposable, retenues: 0, net_a_payer: res.netAPayer, salaire_net: res.netAPayer,
  total_indemnites_non_imposables: 30000, total_autres_retenues: 0, cout_salarial: res.coutSalarial,
};

describe("PDF bulletin depuis lignes enregistrées", () => {
  const d = construireDonneesPdf(b, stockees, null, ENTREPRISE_FABS);
  it("net à payer = valeur enregistrée 161 900", () => expect(d.totaux.netAPayer).toBe(161900));
  it("brut imposable 141 872", () => expect(d.totaux.salaireImposable).toBe(141872));
  it("ITS net = impôt brut − RICF (10 700 − 22 000 → 0)", () => {
    const its = d.lignes!.find((l) => l.code === "401");
    expect(its?.retenue).toBe(0);
  });
  it("transport non imposable, charges patronales à part", () => {
    expect(d.lignes!.find((l) => l.libelle === "Indemnité de transport")?.imposable).toBe(false);
    expect(d.patronales!.length).toBeGreaterThan(0);
    expect(d.lignes!.some((l) => l.libelle.includes("patronale"))).toBe(false);
  });
});

import { calculerCumuls, lignesPourPdf as lpp } from "./bulletin-pdf-data";
describe("cumuls annuels et lignes de retenue", () => {
  it("additionne CR, ITS, brut et jours depuis les bulletins enregistrés", () => {
    const c = calculerCumuls([
      { brut_imposable: 141872, jours_travailles: 30, lignes: [{ numero_rubrique: "469", retenue: 8938 }, { numero_rubrique: "413", retenue: 0 }] },
      { brut_imposable: 141872, jours_travailles: 30, lignes: [{ numero_rubrique: "469", retenue: 8938 }] },
    ]);
    expect(c.cr).toBe(17876);
    expect(c.its).toBe(0);
    expect(c.brutImposable).toBe(283744);
    expect(c.jrsTravailles).toBe(60);
  });
  it("garde retenue: 0 pour un ITS annulé par la RICF", () => {
    const { lignes } = lpp([
      { numero_rubrique: "413", designation: "ITS", libelle: null, nombre: null, base: 141872, taux: null, gain: 0, retenue: 0, bloc: "retenue", ordre: 1 },
    ]);
    expect(lignes[0].retenue).toBe(0);
    expect(lignes[0].imposable).toBe(true);
  });
});

import { nomEtPrenoms } from "./bulletin-pdf-data";
import { dateEnLettres } from "@/lib/pdf/bulletinPaieCI";
describe("bulletin : textes en lettres", () => {
  it("ajoute les prénoms au nom sans les doubler", () => {
    expect(nomEtPrenoms("NIANGORAN", "Konan Paul")).toBe("NIANGORAN Konan Paul");
    expect(nomEtPrenoms("NIANGORAN Konan Paul", "Konan Paul")).toBe("NIANGORAN Konan Paul");
  });
  it("écrit les dates sans numéro de mois, 1er pour le premier jour", () => {
    expect(dateEnLettres("2026-10-20")).toBe("20 octobre 2026");
    expect(dateEnLettres("2026-11-01")).toBe("1er novembre 2026");
  });
});

describe("CMU 470 dans les retenues fiscales et sociales", () => {
  it("ancienne ligne 776 non imposable affichée en 470 retenue", () => {
    const { lignes } = lignesPourPdf([
      { numero_rubrique: "469", designation: "C.R", libelle: null, nombre: null, base: null, taux: null, gain: 0, retenue: 10091, bloc: "retenue", ordre: 1 },
      { numero_rubrique: "776", designation: "Retenue CMU", libelle: null, nombre: null, base: null, taux: null, gain: 0, retenue: 500, bloc: "non_imposable", ordre: 2 },
    ]);
    const cmu = lignes.find((l) => l.code === "470")!;
    expect(cmu.imposable).toBe(true);
    expect(lignes.filter((l) => l.imposable).reduce((s, l) => s + (l.retenue ?? 0), 0)).toBe(10591);
  });
  it("nouveau calcul : CMU 470 en bloc retenue", () => {
    expect(res.lignes.find((l) => l.numero === "470")?.bloc).toBe("retenue");
  });
});
