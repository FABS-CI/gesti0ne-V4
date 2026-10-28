import { describe, expect, it } from "vitest";
import { calculerBulletin, prorataJours, its2024, igr2022, REGIME_2022, REGIME_2024, regimePourDate } from "./regimes-ci";

const modele = { salaireBase: 60000, sursalaire: 77672, tauxAnciennete: 7, transport: 30000, parts: 3 };

describe("REGIME_2024 — bulletin modèle", () => {
  const b = calculerBulletin(modele, REGIME_2024);
  it("brut imposable 141 872", () => expect(b.brutImposable).toBe(141872));
  it("ITS brut 10 700, RICF 22 000, ITS 0", () => {
    expect(b.itsBrut).toBe(10700); expect(b.ricf).toBe(22000); expect(b.its).toBe(0);
  });
  it("CR 8 938", () => expect(b.cr).toBe(8938));
  it("CMU salarié forfait 500 FCFA", () => expect(b.cmu).toBe(500));
  it("net avant arrondi 162 434, arrondi +1, net 162 435 (multiple de 5 supérieur)", () => {
    expect(b.netAvantArrondi).toBe(162434); expect(b.arrondi).toBe(1); expect(b.netAPayer).toBe(162435);
  });
  it("charges patronales indicatives", () => {
    expect(b.patronal).toMatchObject({ retraite: 10924, pf: 3500, maternite: 525, at: 1400, cmu: 500 });
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
  it("net 158 100 (IGR saisi 1 693, CMU 500)", () => expect(b.netAPayer).toBe(158100));
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

describe("cas APPIA (nov. 2025, miroir du calcul serveur)", () => {
  it("brut 160 172, CR 10 091, retenues 10 591, arrondi +4, net 179 585", () => {
    const r = calculerBulletin(
      { salaireBase: 75000, sursalaire: 77672, tauxAnciennete: 10, transport: 30000, parts: 3 },
      { ...REGIME_2024, cmuSalarie: 500, arrondiUnite: 5, arrondiMode: "superieur" },
    );
    expect(r.brutImposable).toBe(160172);
    expect(r.cr).toBe(10091);
    expect(r.its).toBe(0);
    expect(r.totalRetenuesFiscalesSociales).toBe(10591);
    expect(r.arrondi).toBe(4);
    expect(r.netAPayer).toBe(179585);
  });
});

describe("jours non payés (miroir de paie_calculer_bulletin)", () => {
  const base = { salaireBase: 150000, sursalaire: 30000, tauxAnciennete: 10, transport: 30000, parts: 1 };

  it("mois complet : aucun prorata", () => {
    expect(prorataJours(30, 30)).toBe(1);
    expect(prorataJours(undefined, 30)).toBe(1);
    expect(prorataJours(35, 30)).toBe(1);
  });

  it("10 jours d'absence sur 30 : salaire, sursalaire, ancienneté et transport aux deux tiers", () => {
    const plein = calculerBulletin(base, REGIME_2024);
    const absent = calculerBulletin({ ...base, joursTravailles: 20 }, REGIME_2024);
    // 100 000 + 20 000 + 10 000 d'ancienneté
    expect(absent.brutImposable).toBe(130000);
    expect(plein.brutImposable).toBe(195000);
    expect(absent.totalIndemnitesNonImposables - Math.max(0, absent.arrondi)).toBe(20000);
    const l150 = absent.lignes.find((l) => l.numero === "150")!;
    expect([l150.nombre, l150.base, l150.gain]).toEqual([20, 150000, 100000]);
  });

  it("absent tout le mois : rien n'est payé", () => {
    const r = calculerBulletin({ ...base, joursTravailles: 0 }, REGIME_2024);
    expect(r.brutImposable).toBe(0);
  });
});
