import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";

// solde > 0 : débiteur ; solde < 0 : créditeur.
const ligne = (compte: string, solde: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

// Balance reconstituée à partir de la liasse DGI 2025 d'EDITION FABS-CI
// (classeur « EDITION FABS-CI2025.xlsm ») : les états calculés doivent
// retrouver les montants déclarés.
const GESTION_2025 = [
  ligne("7011", -515_053_551),
  ligne("6011", 410_742_724),
  ligne("6041", 9_698_400),
  ligne("6181", 2_248_500),
  ligne("6221", 6_755_550),
  ligne("6411", 2_894_023),
  ligne("6611", 36_881_136),
  ligne("6813", 250_000),
  ligne("8911", 11_395_805),
];
const BILAN_2025 = [
  ligne("1013", -10_000_000),
  ligne("1111", -3_089_874),
  ligne("1211", -42_296_092),
  ligne("2441", 2_500_000),
  ligne("28441", -1_812_500),
  ligne("2451", 2_850_000),
  ligne("28451", -2_850_000),
  ligne("4111", 53_781_256),
  ligne("4011", -12_856_500),
  ligne("4411", -11_395_805),
  ligne("4431", -7_982_315),
  ligne("5211", 67_339_243),
];

describe("calculerEtatsFinanciers — liasse 2025 EDITION FABS-CI", () => {
  const ef = calculerEtatsFinanciers([...BILAN_2025, ...GESTION_2025], GESTION_2025);

  it("retrouve le compte de résultat déclaré", () => {
    expect(ef.resultat.TA).toBe(515_053_551);
    expect(ef.resultat.RA).toBe(-410_742_724);
    expect(ef.resultat.XA).toBe(104_310_827);
    expect(ef.resultat.XB).toBe(515_053_551);
    expect(ef.resultat.XC).toBe(82_714_354);
    expect(ef.resultat.XD).toBe(45_833_218);
    expect(ef.resultat.XE).toBe(45_583_218);
    expect(ef.resultat.XG).toBe(45_583_218);
    expect(ef.resultat.RS).toBe(-11_395_805);
    expect(ef.resultat.XI).toBe(34_187_413);
  });

  it("retrouve l'actif déclaré (brut, amortissements, net)", () => {
    expect(ef.actif.AM).toEqual({ brut: 2_500_000, amort: 1_812_500, net: 687_500 });
    expect(ef.actif.AN).toEqual({ brut: 2_850_000, amort: 2_850_000, net: 0 });
    expect(ef.actif.AZ).toEqual({ brut: 5_350_000, amort: 4_662_500, net: 687_500 });
    expect(ef.actif.BI.net).toBe(53_781_256);
    expect(ef.actif.BS.net).toBe(67_339_243);
    expect(ef.actif.BZ).toEqual({ brut: 126_470_499, amort: 4_662_500, net: 121_807_999 });
  });

  it("retrouve le passif déclaré", () => {
    expect(ef.passif.CA).toBe(10_000_000);
    expect(ef.passif.CH).toBe(42_296_092);
    expect(ef.passif.CJ).toBe(34_187_413);
    expect(ef.passif.CP).toBe(89_573_379);
    expect(ef.passif.DJ).toBe(12_856_500);
    expect(ef.passif.DK).toBe(19_378_120);
    expect(ef.passif.DP).toBe(32_234_620);
    expect(ef.passif.DZ).toBe(121_807_999);
  });

  it("bilan équilibré, résultat cohérent, aucun compte oublié", () => {
    expect(ef.controles).toEqual({ ecartBilan: 0, ecartResultat: 0 });
    expect(ef.comptesNonClasses).toEqual([]);
    expect(ef.resultatAnterieurNonAffecte).toBe(0);
  });
});

describe("calculerEtatsFinanciers — règles de classement", () => {
  it("classe les comptes de tiers selon le sens du solde", () => {
    const ef = calculerEtatsFinanciers(
      [ligne("4111", -500), ligne("4011", 300), ligne("5211", -1_000), ligne("1011", 1_200)],
      [],
    );
    expect(ef.passif.DI).toBe(500); // client créditeur : avance reçue
    expect(ef.actif.BH.net).toBe(300); // fournisseur débiteur : avance versée
    expect(ef.passif.DR).toBe(1_000); // banque créditrice : découvert
  });

  it("met au report à nouveau le résultat d'exercices antérieurs non clôturés", () => {
    // 2024 : 100 de ventes jamais virées au compte 12 ou 13 ; 2025 : 40 de ventes.
    const cumul = [ligne("7011", -140), ligne("5211", 140)];
    const periode = [ligne("7011", -40)];
    const ef = calculerEtatsFinanciers(cumul, periode);
    expect(ef.resultatAnterieurNonAffecte).toBe(100);
    expect(ef.passif.CH).toBe(100);
    expect(ef.passif.CJ).toBe(40);
    expect(ef.resultat.XI).toBe(40);
    expect(ef.controles.ecartBilan).toBe(0);
  });

  it("signale les comptes hors plan sans les perdre", () => {
    const ef = calculerEtatsFinanciers([ligne("???", 10), ligne("5211", -10)], []);
    expect(ef.comptesNonClasses).toEqual([{ compte: "???", libelle: "", solde: 10 }]);
    expect(ef.controles.ecartBilan).not.toBe(0);
  });
});
