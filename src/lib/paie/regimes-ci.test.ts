import { describe, expect, it } from "vitest";
import { calculerBulletin, its2024, igr2022, REGIME_2022, REGIME_2024, regimePourDate } from "./regimes-ci";

const modele = { salaireBase: 60000, sursalaire: 77672, tauxAnciennete: 7, transport: 30000, parts: 3 };

describe("REGIME_2024 — bulletin modèle", () => {
  const b = calculerBulletin(modele, REGIME_2024);
  it("brut imposable 141 872", () => expect(b.brutImposable).toBe(141872));
  it("ITS brut 10 700, RICF 22 000, ITS 0", () => {
    expect(b.itsBrut).toBe(10700); expect(b.ricf).toBe(22000); expect(b.its).toBe(0);
  });
  it("CR 8 938", () => expect(b.cr).toBe(8938));
  it("CMU salarié forfait 1 000 FCFA", () => expect(b.cmu).toBe(1000));
  it("net avant arrondi 161 934, arrondi −34, net 161 900 (CMU 1 000)", () => {
    expect(b.netAvantArrondi).toBe(161934); expect(b.arrondi).toBe(-34); expect(b.netAPayer).toBe(161900);
  });
  it("charges patronales indicatives", () => {
    expect(b.patronal).toMatchObject({ retraite: 10924, pf: 3500, maternite: 525, at: 1400, cmu: 1000 });
  });
});

describe("REGIME_2024 — ITS seul", () => {
  it.each([[150000, 1, 12000], [300000, 2, 28000], [500000, 3, 59000], [1000000, 5, 148000]])(
    "%i / %i parts → %i", (brut, parts, its) => expect(its2024(brut, parts).its).toBe(its));
  it("bulletin 2024 : ITS salarié toujours 0 même si le barème donne plus", () => {
    const b = calculerBulletin({ salaireBase: 500000, sursalaire: 0, tauxAnciennete: 0, transport: 0, parts: 1 }, REGIME_2024);
    expect(b.itsBrut).toBeGreaterThan(0);
    expect(b.its).toBe(0);
  });
});

describe("REGIME_2022 — août 2022", () => {
  const b = calculerBulletin({ ...modele, igrManuel: 1693 }, REGIME_2022);
  it("ITS 1 702", () => expect(b.its).toBe(1702));
  it("CN 942", () => expect(b.cn).toBe(942));
  it("CR 8 938", () => expect(b.cr).toBe(8938));
  it("net 157 600 (IGR saisi 1 693, CMU 1 000)", () => expect(b.netAPayer).toBe(157600));
  it.todo("IGR 1 693 calculé par formule");
});

it("régime selon date de fin", () => {
  expect(regimePourDate("2023-12-31")).toBe("REGIME_2022");
  expect(regimePourDate("2024-01-31")).toBe("REGIME_2024");
});

describe("IGR 2022 = barème ITS 2024 − RICF", () => {
  it("150 000 avec 1 part donne 12 000", () => {
    expect(igr2022(150000, 1)).toBe(12000);
  });
  it("ne descend jamais sous 0", () => {
    expect(igr2022(141872, 3)).toBe(0);
  });
});
