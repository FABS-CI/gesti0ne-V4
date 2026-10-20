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
  it("net à payer = valeur enregistrée 162 400", () => expect(d.totaux.netAPayer).toBe(162400));
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
