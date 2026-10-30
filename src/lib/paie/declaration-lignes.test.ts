import { describe, expect, it } from "vitest";
import {
  computeLignes,
  computeTotaux,
  periodesTriees,
  type BulletinDeclare,
  type LigneBulletinEnregistree,
} from "./declaration-lignes";

const l = (
  numero: string,
  retenue: number,
  bloc = "retenue",
  designation = "",
): LigneBulletinEnregistree => ({
  numero_rubrique: numero,
  code: numero,
  designation,
  libelle: designation,
  bloc,
  retenue,
});

// Lignes telles qu'écrites par paie_calculer_bulletin : brut imposable 270 000, transport 30 000.
const bulletin = (over: Partial<BulletinDeclare> = {}): BulletinDeclare => ({
  bulletin_id: "b1",
  employe_nom: "KOUASSI",
  statut: "valide",
  salaire_brut: 300000,
  brut_imposable: 270000,
  salaire_net: 252490,
  net_a_payer: 252490,
  bulletin_lignes: [
    l("150", 0, "imposable", "Salaire de base"),
    l("401", 0, "retenue", "ITS (Part salariale)"),
    l("469", 17010, "retenue", "C.R"),
    l("470", 500, "retenue", "CMU"),
    l("503", 0, "non_imposable", "Indemnité de transport"),
    l("900", 0, "arrondi", "Arrondi de paie"),
    l("", 20790, "patronal", "Retraite (part patronale)"),
    l("", 3500, "patronal", "Prestations familiales"),
    l("", 525, "patronal", "Maternité"),
    l("", 1400, "patronal", "Accidents du travail"),
    l("", 500, "patronal", "CMU patronale"),
    l("", 2000, "patronal", "Taxes de formation (FDFP)"),
  ],
  ...over,
});

describe("Déclarations de paie", () => {
  it("reprend exactement les montants retenus sur le bulletin", () => {
    const [d] = computeLignes([bulletin()]);
    expect(d).toEqual({
      employe: "KOUASSI",
      brut: 270000,
      cnpsSalarie: 17010,
      cnpsPatronal: 20790,
      pfAt: 5425,
      its: 0, // et non 8 430 recalculés par l'ancien moteur
      cn: 0,
      cmuSalarie: 500,
      cmuPatronal: 500,
      net: 252490,
    });
  });

  it("additionne ITS et IGR, et lit la CN des bulletins du régime 2022", () => {
    const [d] = computeLignes([
      bulletin({ bulletin_lignes: [l("401", 3240), l("420", 2100), l("431", 12000)] }),
    ]);
    expect(d.its).toBe(15240);
    expect(d.cn).toBe(2100);
  });

  it("lit aussi les anciens codes du moteur précédent", () => {
    const [d] = computeLignes([
      bulletin({
        bulletin_lignes: [
          { ...l("", 18900), code: "CNPS_SAL", numero_rubrique: null },
          { ...l("", 8430), code: "ITS", numero_rubrique: null },
          { ...l("", 1000), code: "CMU_SAL", numero_rubrique: null },
        ],
      }),
    ]);
    expect([d.cnpsSalarie, d.its, d.cmuSalarie]).toEqual([18900, 8430, 1000]);
  });

  it("exclut les bulletins annulés et les brouillons, totalise les validés et payés", () => {
    const lignes = computeLignes([
      bulletin(),
      bulletin({ bulletin_id: "b2", statut: "annule" }),
      bulletin({ bulletin_id: "b3", statut: "paye" }),
      bulletin({ bulletin_id: "b4", statut: "brouillon" }),
      bulletin({ bulletin_id: "b5", statut: "genere" }),
    ]);
    expect(lignes).toHaveLength(2);
    const t = computeTotaux(lignes);
    expect(t.brut).toBe(540000);
    expect(t.cnpsSalarie).toBe(34020);
    expect(t.pfAt).toBe(10850);
  });

  it("trie les périodes par date, pas par ordre alphabétique", () => {
    expect(
      periodesTriees([
        { periode: "Août 2026", date_fin: "2026-08-31" },
        { periode: "Octobre 2026", date_fin: "2026-10-31" },
        { periode: "Décembre 2025", date_fin: "2025-12-31" },
        { periode: "Octobre 2026", date_fin: "2026-10-31" },
        { periode: "Septembre 2026", date_fin: "2026-09-30" },
        { periode: null, date_fin: null },
      ]),
    ).toEqual(["Octobre 2026", "Septembre 2026", "Août 2026", "Décembre 2025"]);
  });
});
