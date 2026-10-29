import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";
import {
  assemblerDonnees,
  fusionner,
  type BalanceImportee,
  type DonneesErp,
} from "@/lib/etats-financiers/sources";
import { lireBalance, lireMontant } from "@/lib/etats-financiers/import-balance";
import { champsManquants, resoudreIdentite } from "@/lib/etats-financiers/identite";
import {
  controler,
  dureeMois,
  statutPreparation,
  type Completude,
} from "@/lib/etats-financiers/controles";

const ligne = (compte: string, solde: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

const importee = (
  lignes: Array<[string, number, number?, number?]>,
  avecMouvements = false,
): BalanceImportee => ({
  lotId: "lot",
  fichier: "balance.xlsx",
  importeLe: "2026-01-15",
  avecMouvements,
  lignes: lignes.map(([compte, solde, d, c]) => ({
    compte,
    libelle: null,
    solde,
    mvt_debit: avecMouvements ? (d ?? 0) : null,
    mvt_credit: avecMouvements ? (c ?? 0) : null,
  })),
});

const ERP_VIDE: DonneesErp = {
  cumul: [],
  periode: [],
  ouverture: [],
  ecrituresPeriode: 0,
  ecrituresAvant: 0,
};

// Balance de clôture 2025 d'EDITION FABS-CI (soldes de la liasse DGI).
const BALANCE_2025 = importee([
  ["1013", -10_000_000],
  ["1111", -3_089_874],
  ["1211", -42_296_092],
  ["2441", 2_500_000],
  ["28441", -1_812_500],
  ["2451", 2_850_000],
  ["28451", -2_850_000],
  ["4111", 53_781_256],
  ["4011", -12_856_500],
  ["4411", -11_395_805],
  ["4431", -7_982_315],
  ["5211", 67_339_243],
  ["7011", -515_053_551],
  ["6011", 410_742_724],
  ["6041", 9_698_400],
  ["6181", 2_248_500],
  ["6221", 6_755_550],
  ["6411", 2_894_023],
  ["6611", 36_881_136],
  ["6813", 250_000],
  ["8911", 11_395_805],
]);

describe("assemblerDonnees — priorité ERP, balance importée en complément", () => {
  it("exercice sans écriture : la balance importée redonne la liasse 2025", () => {
    const d = assemblerDonnees({ erp: ERP_VIDE, importN: BALANCE_2025 });
    expect(d.source).toBe("import");
    const ef = calculerEtatsFinanciers(d.cumul, d.periode);
    expect(ef.resultat.XI).toBe(34_187_413);
    expect(ef.actif.BZ.net).toBe(121_807_999);
    expect(ef.controles).toEqual({ ecartBilan: 0, ecartResultat: 0 });
    expect(d.mouvementsConnus).toBe(false);
  });

  it("premier exercice dans l'ERP : ouverture reprise de la balance N-1 importée", () => {
    const erp: DonneesErp = {
      cumul: [ligne("5211", 1_000_000), ligne("7011", -1_000_000)],
      periode: [ligne("5211", 1_000_000), ligne("7011", -1_000_000)],
      ouverture: [],
      ecrituresPeriode: 3,
      ecrituresAvant: 0,
    };
    const d = assemblerDonnees({ erp, importN1: BALANCE_2025 });
    expect(d.source).toBe("erp");
    expect(d.ouvertureImportee).toBe(true);
    const ef = calculerEtatsFinanciers(d.cumul, d.periode);
    expect(ef.actif.BS.net).toBe(68_339_243); // banque 2025 + encaissement 2026
    expect(ef.resultat.XI).toBe(1_000_000); // 2026 seul
    expect(ef.resultatAnterieurNonAffecte).toBe(34_187_413); // résultat 2025 au report à nouveau
    expect(ef.controles.ecartBilan).toBe(0);
  });

  it("l'ERP l'emporte sur une balance importée du même exercice", () => {
    const erp = { ...ERP_VIDE, ecrituresPeriode: 1, cumul: [ligne("5211", 5), ligne("1013", -5)] };
    const d = assemblerDonnees({ erp, importN: BALANCE_2025 });
    expect(d.source).toBe("erp");
    expect(d.importIgnore).toBe(true);
    expect(d.cumul).toEqual(erp.cumul);
  });

  it("balance à 6 colonnes : ouverture déduite et TFT bouclé", () => {
    const b = importee(
      [
        ["1013", -1_000, 0, 0],
        ["2441", 600, 600, 0], // matériel acheté 600
        ["5211", 900, 500, 600], // banque : 1 000 à l'ouverture
        ["7011", -500, 0, 500], // ventes encaissées 500
      ],
      true,
    );
    const d = assemblerDonnees({ erp: ERP_VIDE, importN: b });
    expect(d.ouvertureConnue).toBe(true);
    expect(d.ouverture).toEqual(fusionner([ligne("1013", -1_000), ligne("5211", 1_000)]));
    const ouverture = calculerEtatsFinanciers(d.ouverture, []);
    const ef = calculerEtatsFinanciers(d.cumul, d.periode);
    const tft = calculerTft(ouverture, ef, d.periode);
    expect(tft.valeurs.FG).toBe(-600);
    expect(tft.ecartTresorerie).toBe(0);
  });

  it("ni écriture ni import : aucune donnée", () => {
    expect(assemblerDonnees({ erp: ERP_VIDE }).source).toBe("aucune");
  });
});

describe("lireBalance — fichiers d'autres logiciels", () => {
  it("balance à 6 colonnes avec intitulés, totaux et montants français", () => {
    const r = lireBalance([
      ["BALANCE GÉNÉRALE AU 31/12/2025"],
      [],
      [
        "N° de compte",
        "Intitulé",
        "Solde ouverture débit",
        "Solde ouverture crédit",
        "Mouvements débit",
        "Mouvements crédit",
        "Solde débiteur",
        "Solde créditeur",
      ],
      ["Classe 1"],
      ["101300", "Capital", "", "1 000,00", "", "", "", "1 000,00"],
      ["521100", "Banque", "400", "", "600", "", "1 000", ""],
      ["TOTAL", "", "", "", "", "", "1 000", "1 000"],
    ]);
    expect(r.erreurs).toEqual([]);
    expect(r.avecMouvements).toBe(true);
    expect(r.lignes).toEqual([
      { compte: "101300", libelle: "Capital", solde: -1_000, mvt_debit: 0, mvt_credit: 0 },
      { compte: "521100", libelle: "Banque", solde: 1_000, mvt_debit: 600, mvt_credit: 0 },
    ]);
  });

  it("débit / crédit seuls : solde = débit − crédit", () => {
    const r = lireBalance([
      ["Compte", "Libellé", "Débit", "Crédit"],
      ["4111", "Clients", 1500, 500],
      ["7011", "Ventes", 0, 1000],
    ]);
    expect(r.erreurs).toEqual([]);
    expect(r.lignes.map((l) => [l.compte, l.solde])).toEqual([
      ["4111", 1000],
      ["7011", -1000],
    ]);
  });

  it("refuse un fichier déséquilibré, un compte en double, un montant illisible", () => {
    expect(
      lireBalance([
        ["Compte", "Solde"],
        ["5211", 10],
      ]).erreurs[0],
    ).toMatch(/déséquilibrée/);
    expect(
      lireBalance([
        ["Compte", "Solde"],
        ["5211", 10],
        ["5211", -10],
      ]).erreurs[0],
    ).toMatch(/en double/);
    expect(
      lireBalance([
        ["Compte", "Solde"],
        ["5211", "dix"],
      ]).erreurs[0],
    ).toMatch(/illisible/);
    expect(lireBalance([["Code", "Montant"]]).erreurs[0]).toMatch(/Compte/);
  });

  it("lit les montants des tableurs", () => {
    expect(lireMontant("1 234 567,50")).toBe(1_234_567.5);
    expect(lireMontant("(1 200)")).toBe(-1_200);
    expect(lireMontant("1.234,5")).toBe(1_234.5);
    expect(lireMontant("")).toBe(0);
    expect(lireMontant("abc")).toBeNull();
  });
});

describe("identité de l'entité", () => {
  it("reprend les paramètres FNE, la saisie liasse l'emporte", () => {
    const id = resoudreIdentite(
      { "liasse.ncc": "2302562N" },
      { company_name: "EDITION FABS-CI", company_ncc: "999", company_idu: "6895486784871" },
    );
    expect(id.denomination).toEqual({ valeur: "EDITION FABS-CI", origine: "fne" });
    expect(id.ncc).toEqual({ valeur: "2302562N", origine: "liasse" });
    expect(champsManquants(id).map((c) => c.cle)).toContain("centre_depot");
    expect(champsManquants(id).map((c) => c.cle)).not.toContain("ntd");
  });
});

describe("controler", () => {
  const exercice = { date_debut: "2025-01-01", date_fin: "2025-12-31" };
  const identiteComplete = resoudreIdentite(
    {
      "liasse.denomination": "EDITION FABS-CI",
      "liasse.ncc": "2302562N",
      "liasse.ntd": "6895486784871",
      "liasse.rccm": "CI-ABJ-03-2023-B12-03073",
      "liasse.centre_depot": "BINGERVILLE",
      "liasse.adresse": "BP 693 BINGERVILLE",
      "liasse.activite": "Édition, travaux d'imprimerie",
      "liasse.signataire_nom": "ALI MAMIN",
      "liasse.signataire_qualite": "GÉRANT",
    },
    {},
  );
  const completudeOk: Completude = {
    ecritures_periode: 10,
    ecritures_avant: 5,
    ecritures_sans_exercice: 0,
    ecritures_a_nouveaux: 0,
    ecritures_desequilibrees: 0,
    factures_non_comptabilisees: 0,
    factures_non_comptabilisees_montant: 0,
    bulletins_valides: 12,
    paie_brut: 36_881_136,
  };
  const donnees = assemblerDonnees({ erp: ERP_VIDE, importN: BALANCE_2025 });
  const ef = calculerEtatsFinanciers(donnees.cumul, donnees.periode);
  const tft = calculerTft(calculerEtatsFinanciers([], []), ef, donnees.periode);
  const base = {
    exercice,
    donnees: { ...donnees, ouvertureConnue: true, mouvementsConnus: true },
    ef,
    tft: { ...tft, ecartTresorerie: 0 },
    ouverture: calculerEtatsFinanciers([], []),
    completude: completudeOk,
    identite: identiteComplete,
  };

  it("liasse 2025 complète : aucun blocage", () => {
    const c = controler(base);
    expect(c.filter((x) => x.niveau === "bloquant")).toEqual([]);
    expect(statutPreparation(c)).not.toBe("incomplet");
  });

  it("paie validée non comptabilisée : avertissement", () => {
    const sansPaie = calculerEtatsFinanciers(
      donnees.cumul.filter((r) => r.compte !== "6611"),
      donnees.periode.filter((r) => r.compte !== "6611"),
    );
    const c = controler({ ...base, ef: sansPaie });
    expect(c.find((x) => x.code === "paie")?.niveau).toBe("avertissement");
  });

  it("identité incomplète et écritures déséquilibrées : bloquant", () => {
    const c = controler({
      ...base,
      identite: resoudreIdentite({}, {}),
      completude: { ...completudeOk, ecritures_desequilibrees: 2 },
    });
    expect(c.filter((x) => x.niveau === "bloquant").map((x) => x.code)).toEqual(
      expect.arrayContaining(["identite", "ecritures_desequilibrees"]),
    );
    expect(statutPreparation(c)).toBe("incomplet");
  });

  it("aucune donnée : bloquant, rien d'autre n'est contrôlé", () => {
    const c = controler({ ...base, donnees: assemblerDonnees({ erp: ERP_VIDE }) });
    expect(c.map((x) => x.code)).toEqual(["aucune_donnee"]);
  });

  it("durée d'exercice", () => {
    expect(dureeMois("2025-01-01", "2025-12-31")).toBe(12);
    expect(dureeMois("2025-07-01", "2026-06-30")).toBe(12);
    expect(dureeMois("2025-04-01", "2025-12-31")).toBe(9);
    const c = controler({
      ...base,
      exercice: { date_debut: "2025-04-01", date_fin: "2025-12-31" },
    });
    expect(c.find((x) => x.code === "duree")?.niveau).toBe("avertissement");
  });
});
