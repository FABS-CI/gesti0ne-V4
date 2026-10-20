import { describe, expect, it } from "vitest";
import { calculerBulletin, REGIME_2024 } from "./regimes-ci";
import { construireDonneesPdf, type BulletinStocke, type LigneStockee } from "./bulletin-pdf-data";
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
    const its = d.lignes!.find((l) => l.code === "413");
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
