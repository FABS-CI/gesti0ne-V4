import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";

// Une ligne de balance par mouvement : débit si montant > 0, crédit sinon.
const mvt = (compte: string, montant: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(montant, 0),
  credit: Math.max(-montant, 0),
  solde: montant,
});

/** Regroupe les mouvements par compte, comme la balance du serveur. */
function balance(...mouvements: BalanceRow[][]): BalanceRow[] {
  const m = new Map<string, BalanceRow>();
  for (const r of mouvements.flat()) {
    const b = m.get(r.compte) ?? { ...mvt(r.compte, 0) };
    b.debit += r.debit;
    b.credit += r.credit;
    b.solde += r.solde;
    m.set(r.compte, b);
  }
  return [...m.values()];
}

function tft(ouvertureRows: BalanceRow[], periodeRows: BalanceRow[]) {
  const cumul = balance(ouvertureRows, periodeRows);
  const ouverture = calculerEtatsFinanciers(ouvertureRows, []);
  const cloture = calculerEtatsFinanciers(cumul, periodeRows);
  return { cloture, ...calculerTft(ouverture, cloture, periodeRows) };
}

// Liasse DGI 2025 d'EDITION FABS-CI : bilan au 31/12/2024 et écritures 2025
// qui mènent au bilan au 31/12/2025.
const OUVERTURE_2025 = [
  mvt("1013", -10_000_000),
  mvt("1111", -3_089_874),
  mvt("1211", -27_808_868),
  mvt("1301", -14_487_224),
  mvt("2441", 2_500_000),
  mvt("28441", -1_562_500),
  mvt("2451", 2_850_000),
  mvt("28451", -2_850_000),
  mvt("4111", 58_890_108),
  mvt("4011", -12_573_080),
  mvt("4431", -7_994_261),
  mvt("5211", 16_504_469),
  mvt("5611", -378_770),
];
const ECRITURES_2025 = [
  // Affectation du résultat 2024 en report à nouveau.
  mvt("1301", 14_487_224),
  mvt("1211", -14_487_224),
  // Gestion 2025.
  mvt("7011", -515_053_551),
  mvt("6011", 410_742_724),
  mvt("6041", 9_698_400),
  mvt("6181", 2_248_500),
  mvt("6221", 6_755_550),
  mvt("6411", 2_894_023),
  mvt("6611", 36_881_136),
  mvt("6813", 250_000),
  mvt("28441", -250_000),
  mvt("8911", 11_395_805),
  // Variations de bilan : clients, fournisseurs, dettes fiscales, trésorerie.
  mvt("4111", -5_108_852),
  mvt("4011", -283_420),
  mvt("4411", -11_395_805),
  mvt("4431", 11_946),
  mvt("5611", 378_770),
];

describe("calculerTft — liasse 2025 EDITION FABS-CI", () => {
  // Contrepartie banque des écritures 2025 : le jeu d'essai est équilibré.
  const BANQUE_2025 = mvt("5211", 50_834_774);

  it("jeu d'essai équilibré", () => {
    expect(ECRITURES_2025.reduce((s, r) => s + r.solde, 0) + BANQUE_2025.solde).toBe(0);
    expect(OUVERTURE_2025.reduce((s, r) => s + r.solde, 0)).toBe(0);
  });

  const { valeurs, ecartTresorerie, cloture } = tft(OUVERTURE_2025, [
    ...ECRITURES_2025,
    BANQUE_2025,
  ]);

  it("retrouve le bilan de clôture déclaré", () => {
    expect(cloture.actif.BS.net).toBe(67_339_243);
    expect(cloture.passif.DR ?? 0).toBe(0);
    expect(cloture.passif.CH).toBe(42_296_092);
    expect(cloture.passif.DP).toBe(32_234_620);
    expect(cloture.controles.ecartBilan).toBe(0);
  });

  it("retrouve le TFT déclaré", () => {
    expect(valeurs.ZA).toBe(16_125_699);
    expect(valeurs.FA).toBe(34_437_413);
    expect(valeurs.FD).toBe(5_108_852);
    expect(valeurs.FE).toBe(11_667_279);
    expect(valeurs.ZB).toBe(51_213_544);
    expect(valeurs.ZC).toBe(0);
    expect(valeurs.ZF).toBe(0);
    expect(valeurs.ZG).toBe(51_213_544);
    expect(valeurs.ZH).toBe(67_339_243);
    expect(ecartTresorerie).toBe(0);
  });
});

describe("calculerTft — investissement et financement", () => {
  const OUVERTURE = [mvt("1013", -1_000), mvt("5211", 1_000)];

  it("acquisition payée, emprunt, remboursement, dividendes : trésorerie bouclée", () => {
    const { valeurs, ecartTresorerie } = tft(OUVERTURE, [
      mvt("2441", 600),
      mvt("5211", -600), // achat de matériel payé
      mvt("5211", 500),
      mvt("1621", -500), // emprunt bancaire reçu
      mvt("1621", 100),
      mvt("5211", -100), // remboursement
      mvt("1013", -200),
      mvt("5211", 200), // augmentation de capital
    ]);
    expect(valeurs.FG).toBe(-600);
    expect(valeurs.FO).toBe(500);
    expect(valeurs.FQ).toBe(-100);
    expect(valeurs.FK).toBe(200);
    expect(valeurs.ZG).toBe(0);
    expect(ecartTresorerie).toBe(0);
  });

  it("immobilisation achetée à crédit : pas de décaissement", () => {
    const { valeurs, ecartTresorerie } = tft(OUVERTURE, [mvt("2441", 300), mvt("4811", -300)]);
    expect(valeurs.FG).toBe(0);
    expect(ecartTresorerie).toBe(0);
  });

  it("dividendes versés sur les réserves", () => {
    const { valeurs, ecartTresorerie } = tft(
      [mvt("1013", -1_000), mvt("1211", -400), mvt("5211", 1_400)],
      [mvt("1211", 150), mvt("5211", -150)],
    );
    expect(valeurs.FN).toBe(-150);
    expect(ecartTresorerie).toBe(0);
  });

  it("cession d'une immobilisation amortie", () => {
    const { valeurs, ecartTresorerie } = tft(
      [mvt("1013", -1_000), mvt("2451", 800), mvt("28451", -500), mvt("5211", 700)],
      [
        mvt("28451", 500),
        mvt("2451", -800),
        mvt("8121", 300), // sortie, VNC 300
        mvt("5211", 450),
        mvt("8221", -450), // prix de cession encaissé
      ],
    );
    expect(valeurs.FA).toBe(0); // plus-value de 150 retirée de la CAFG
    expect(valeurs.FI).toBe(450);
    expect(ecartTresorerie).toBe(0);
  });
});
