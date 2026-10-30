import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";
import { SOLDES_2025 } from "@/lib/etats-financiers/fixtures-2025";
import { calculerNotes, type NoteCalculee } from "@/lib/etats-financiers/notes";
import { calculerNotesImmobilisations } from "@/lib/etats-financiers/notes-immobilisations";
import { CORRESPONDANCES_NOTES_2025, libelleComparable } from "@/lib/etats-financiers/notes-modele";
import {
  ecrireCellule,
  nomFichierExcel,
  NOM_FEUILLE_RAPPORT,
  remplirModele,
} from "@/lib/etats-financiers/excel-modele";

const ligne = ([compte, solde]: [string, number]): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

function etats2025() {
  const b = SOLDES_2025.map(ligne);
  const ef = calculerEtatsFinanciers(b, b);
  const ouverture = calculerEtatsFinanciers([], []);
  return { ...ef, tft: calculerTft(ouverture, ef, b) };
}

const exercice = { date_debut: "2025-01-01", date_fin: "2025-12-31" };
const identite = { denomination: "EDITION FABS-CI", ncc: "2302562N", sigle: "FABS" };

/** Petit modèle : mêmes repères que la liasse DGI (codes en A et J, en-têtes =SOCIETE). */
function petitModele(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const bilan = XLSX.utils.aoa_to_sheet([["BILAN"]]);
  XLSX.utils.sheet_add_aoa(bilan, [["AD", "Immobilisations incorporelles"]], { origin: "A11" });
  XLSX.utils.sheet_add_aoa(bilan, [["BI", "Clients", "", "", "", 1, 2, 3, 4]], { origin: "A31" });
  XLSX.utils.sheet_add_aoa(bilan, [["CA", "Capital", "", 7, 8]], { origin: "J11" });
  bilan.C3 = { t: "s", v: "", f: "SOCIETE" };
  bilan.C5 = { t: "s", v: "", f: "NCC" };
  bilan.K5 = { t: "s", v: "", f: "CLOTURE" };
  bilan["!ref"] = "A1:N40";
  XLSX.utils.book_append_sheet(wb, bilan, "BILAN");
  const resultat = XLSX.utils.aoa_to_sheet([["RESULTAT"]]);
  XLSX.utils.sheet_add_aoa(resultat, [["TA", "Ventes", "", "", "", "", "", "", 5, 6]], {
    origin: "A11",
  });
  XLSX.utils.book_append_sheet(wb, resultat, "RESULTAT");
  const actif = XLSX.utils.aoa_to_sheet([["ACTIF"]]);
  actif.H31 = { t: "n", v: 0, f: "BILAN!H31" };
  actif["!ref"] = "A1:H31";
  XLSX.utils.book_append_sheet(wb, actif, "ACTIF");
  const note = XLSX.utils.aoa_to_sheet([["NOTE 1"]]);
  XLSX.utils.sheet_add_aoa(note, [["Effectif", 12]], { origin: "A12" });
  XLSX.utils.book_append_sheet(wb, note, "NOTE 1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

describe("ecrireCellule", () => {
  const xml =
    '<sheetData><row r="2" spans="1:3"><c r="A2" s="4"><f>SOCIETE</f><v>x</v></c><c r="C2" s="1"/></row><row r="3"/></sheetData>';

  it("remplace valeur et formule, garde le style", () => {
    const r = ecrireCellule(xml, "A2", "FABS & Cie");
    expect(r.ok).toBe(true);
    expect(r.xml).toContain(
      '<c r="A2" s="4" t="inlineStr"><is><t xml:space="preserve">FABS &amp; Cie</t></is></c>',
    );
    expect(r.xml).not.toContain("<f>");
    expect(ecrireCellule(xml, "C2", 42).xml).toContain('<c r="C2" s="1"><v>42</v></c>');
  });

  it("crée une cellule absente à sa place dans la ligne", () => {
    expect(ecrireCellule(xml, "B2", 5).xml).toContain(
      '<f>SOCIETE</f><v>x</v></c><c r="B2"><v>5</v></c><c r="C2" s="1"/>',
    );
    expect(ecrireCellule(xml, "A3", 1).xml).toContain('<row r="3"><c r="A3"><v>1</v></c></row>');
  });

  it("valeur inconnue : cellule vidée, jamais mise à zéro", () => {
    expect(ecrireCellule(xml, "C2", null).xml).toContain('<c r="C2" s="1"/>');
  });

  it("ligne absente : signalée", () => {
    expect(ecrireCellule(xml, "A9", 1).ok).toBe(false);
  });
});

describe("remplirModele — petit modèle", () => {
  it("remplit les postes repérés par leur code et les en-têtes", async () => {
    const { fichier, macros, rapport } = await remplirModele({
      modele: petitModele(),
      n: etats2025(),
      exercice,
      identite,
      informations: [["Dossier", "version 3 (validée)"]],
    });
    expect(macros).toBe(false);
    const wb = XLSX.read(fichier, { type: "array", cellFormula: true });
    const b = wb.Sheets.BILAN;
    // Clients (BI) : brut, amortissements, net ; N-1 inconnu → vide.
    expect([b.F31.v, b.G31.v, b.H31.v]).toEqual([53_781_256, 0, 53_781_256]);
    expect(b.I31?.v).toBeUndefined();
    expect(b.M11.v).toBe(10_000_000);
    expect(b.N11?.v).toBeUndefined();
    expect(wb.Sheets.RESULTAT.I11.v).toBe(515_053_551);
    // En-têtes : valeurs à la place des liens externes.
    expect(b.C3.v).toBe("EDITION FABS-CI");
    expect(b.C3.f).toBeUndefined();
    expect(b.C5.v).toBe("2302562N");
    expect(b.K5.v).toBe("31/12/2025");
    // Formules des autres feuilles intactes.
    expect(wb.Sheets.ACTIF.H31.f).toBe("BILAN!H31");

    expect(rapport.n1Absent).toBe(true);
    expect(rapport.feuillesMisesAJour).toEqual(["BILAN", "RESULTAT", "ACTIF"]);
    expect(rapport.feuillesAVerifier).toEqual(["NOTE 1"]);
    // Postes que ce petit modèle ne contient pas : signalés, pas devinés.
    expect(rapport.introuvables).toContain("BILAN : AE");
    expect(rapport.introuvables).toContain("TFT : feuille absente du modèle");

    expect(wb.SheetNames.at(-1)).toBe(NOM_FEUILLE_RAPPORT);
    const lisezMoi = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[NOM_FEUILLE_RAPPORT], {
      header: 1,
    });
    expect(lisezMoi).toContainEqual(["Dossier", "version 3 (validée)"]);
    expect(lisezMoi.some((l) => l[1] === "NOTE 1")).toBe(true);
  });

  it("colonne N-1 remplie quand l'exercice précédent est connu", async () => {
    const n = etats2025();
    const { fichier, rapport } = await remplirModele({
      modele: petitModele(),
      n,
      n1: n,
      exercice,
      identite,
    });
    const b = XLSX.read(fichier, { type: "array" }).Sheets.BILAN;
    expect(b.I31.v).toBe(53_781_256);
    expect(b.N11.v).toBe(10_000_000);
    expect(rapport.n1Absent).toBe(false);
  });

  it("nom du fichier", () => {
    expect(nomFichierExcel("2026", true)).toBe("ETATS_FINANCIERS_FABS_CI_2026.xlsm");
    expect(nomFichierExcel("2026", false)).toBe("ETATS_FINANCIERS_FABS_CI_2026.xlsx");
  });
});

describe("remplirModele — notes annexes", () => {
  /** Feuille NOTE 7 réduite : en-tête « Année N / N-1 », totaux en formules, échéances. */
  function modeleNotes(): Uint8Array {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["NOTE 7 : CLIENTS"]]);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ["Libellés", "", "", "", "Année N", "Année N-1", "Variation", "Échéance"],
        ["Clients (hors réserves de propriété et Groupe)", "", "", "", 999, 888, "", 777],
        ["Clients effets à recevoir (hors réserves de propriété et groupe)", "", "", "", 5, 5],
        ["Clients avec réserves de propriété", "", "", "", 6, 6],
        ["TOTAL BRUT CLIENTS"],
        ["Dépréciations des comptes clients", "", "", "", 0, 0],
        ["Commentaire :", "", "", "", 42],
      ],
      { origin: "A8" },
    );
    ws.E12 = { t: "n", v: 0, f: "SUM(E9:E11)" };
    ws.G9 = { t: "n", v: 0, f: 'IF(F9,(E9-F9)/F9,"")' };
    ws["!ref"] = "A1:H14";
    XLSX.utils.book_append_sheet(wb, ws, "NOTE 7");
    const n21 = XLSX.utils.aoa_to_sheet([["NOTE 21"]]);
    XLSX.utils.sheet_add_aoa(
      n21,
      [
        ["Libellés", "", "", "", "", "Année N", "Année N-1"],
        ["Ventes de marchandises dans l'Etat partie", "", "", "", "", 1, 1],
      ],
      { origin: "A8" },
    );
    XLSX.utils.book_append_sheet(wb, n21, "NOTE 21");
    return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  }

  const note7 = (clients: number, depreciation: number): NoteCalculee => ({
    numero: "7",
    titre: "Clients",
    lignes: [
      {
        libelle: "Clients (hors réserves de propriété et groupe)",
        montant: clients,
        niveau: "detail",
      },
      { libelle: "Clients effets à recevoir (hors groupe)", montant: 0, niveau: "detail" },
      { libelle: "Autres comptes (non ventilé)", montant: 12, niveau: "detail" },
      { libelle: "TOTAL BRUT CLIENTS", montant: clients + 12, niveau: "total" },
      { libelle: "Dépréciations des comptes clients", montant: depreciation, niveau: "detail" },
    ],
  });
  const note21: NoteCalculee = {
    numero: "21",
    titre: "Chiffre d'affaires",
    lignes: [{ libelle: "Ventes de marchandises", montant: 500, niveau: "detail" }],
  };

  async function remplir(n1: boolean) {
    const n = { ...etats2025(), notes: [note7(1000, -300), note21] };
    const { fichier, rapport } = await remplirModele({
      modele: modeleNotes(),
      n,
      n1: n1 ? { ...etats2025(), notes: [note7(800, -100), note21] } : undefined,
      exercice,
      identite,
    });
    return { ws: XLSX.read(fichier, { type: "array", cellFormula: true }).Sheets, rapport };
  }

  it("place chaque ligne sur son libellé, correspondances explicites comprises", async () => {
    const { ws } = await remplir(true);
    const s = ws["NOTE 7"];
    expect([s.E9.v, s.F9.v]).toEqual([1000, 800]);
    // « (hors groupe) » de l'ERP ↔ « (hors réserves de propriété et groupe) » du modèle.
    expect([s.E10.v, s.F10.v]).toEqual([0, 0]);
    // Dépréciation négative dans l'ERP, positive dans le modèle (TOTAL NET = brut − dép.).
    expect([s.E13.v, s.F13.v]).toEqual([300, 100]);
    expect(ws["NOTE 21"].F9.v).toBe(500);
  });

  it("ligne non calculée et échéances : vidées, jamais laissées aux chiffres du modèle", async () => {
    const { ws } = await remplir(true);
    const s = ws["NOTE 7"];
    expect(s.E11?.v).toBeUndefined(); // réserves de propriété : absente des notes calculées
    expect(s.H9?.v).toBeUndefined(); // échéance du modèle effacée
    expect(s.E12.f).toBe("SUM(E9:E11)"); // total : formule conservée
    expect(s.G9.f).toBeDefined(); // variation : formule conservée
    expect(s.E14.v).toBe(42); // sous « Commentaire » : non touché
  });

  it("sans N-1 : colonne N-1 vide", async () => {
    const { ws } = await remplir(false);
    expect(ws["NOTE 7"].F9?.v).toBeUndefined();
  });

  it("ligne sans place dans le modèle et hypothèses : signalées", async () => {
    const { rapport } = await remplir(true);
    expect(rapport.introuvables).toContain("NOTE 7 : « Autres comptes (non ventilé) » (12)");
    expect(rapport.notesRemplies).toEqual(["NOTE 7", "NOTE 21"]);
    expect(rapport.hypotheses).toHaveLength(1);
    expect(rapport.hypotheses[0]).toMatch(/NOTE 21 : .*Etat partie/);
    expect(rapport.feuillesMisesAJour).toContain("NOTE 7");
    expect(rapport.feuillesAVerifier).not.toContain("NOTE 7");
  });
});

// Classeur réel (confidentiel, hors dépôt) : MODELE_LIASSE=chemin/vers/le/modele.xlsm
const MODELE = process.env.MODELE_LIASSE;
describe.skipIf(!MODELE)("remplirModele — classeur DGI 2025 réel", () => {
  it("les montants écrits pour 2025 sont ceux du classeur, macros conservées", async () => {
    const modele = new Uint8Array(readFileSync(MODELE!));
    const avant = XLSX.read(modele, { type: "array" });
    const b = SOLDES_2025.map(ligne);
    const { fichier, macros, rapport } = await remplirModele({
      modele,
      n: {
        ...etats2025(),
        notes: calculerNotes(b, b),
        immobilisations: calculerNotesImmobilisations({
          ouverture: [],
          periode: b,
          cumul: b,
          ouvertureConnue: false,
          mouvementsConnus: true,
        }),
      },
      exercice,
      identite,
    });
    expect(macros).toBe(true);
    expect(rapport.introuvables).toEqual([]);
    // Les 10 notes calculées trouvent toutes leurs lignes dans le modèle.
    expect(rapport.notesRemplies).toHaveLength(14);
    const apres = XLSX.read(fichier, { type: "array", bookVBA: true });
    expect(apres.vbaraw).toBeTruthy();
    // Colonnes N du bilan et du compte de résultat : identiques au classeur déposé.
    const ecarts: string[] = [];
    for (const [feuille, colonnes] of [
      ["BILAN", ["F", "G", "H", "M"]],
      ["RESULTAT", ["I"]],
    ] as const) {
      const a = avant.Sheets[feuille];
      const p = apres.Sheets[feuille];
      for (let r = 11; r <= 56; r++)
        for (const c of colonnes) {
          const x = a[`${c}${r}`];
          if (typeof x?.v !== "number") continue;
          if (p[`${c}${r}`]?.v !== x.v)
            ecarts.push(`${feuille}!${c}${r} ${x.v} → ${p[`${c}${r}`]?.v}`);
        }
    }
    expect(ecarts).toEqual([]);
    expect(apres.SheetNames.length).toBe(avant.SheetNames.length + 1);
  });
});

describe("remplirModele — notes 3 (tableaux de mouvements)", () => {
  it("écrit chaque colonne à sa place, sans toucher aux formules du modèle", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["NOTE 3C BIS"]]);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ["Matériel de transport", "", "", 9, "", 9, "", 9],
        ["IMMOBILISATIONS CORPORELLES"],
        ["Commentaire :", "", "", 42],
      ],
      { origin: "A21" },
    );
    ws.J21 = { t: "n", v: 0, f: "D21+F21-H21" };
    ws.D22 = { t: "n", v: 0, f: "SUM(D21:D21)" };
    ws["!ref"] = "A1:J23";
    XLSX.utils.book_append_sheet(wb, ws, "NOTE 3C BIS");
    const modele = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const { fichier, rapport } = await remplirModele({
      modele,
      n: {
        ...etats2025(),
        immobilisations: [
          {
            numero: "3C BIS",
            titre: "Dépréciations",
            colonnes: [
              { cle: "ouverture", libelle: "" },
              { cle: "dotations", libelle: "" },
              { cle: "diminutions", libelle: "" },
              { cle: "cloture", libelle: "" },
            ],
            lignes: [
              {
                libelle: "Matériel de transport",
                niveau: "detail",
                valeurs: { ouverture: 100, dotations: 50, diminutions: null, cloture: 150 },
              },
              {
                libelle: "IMMOBILISATIONS CORPORELLES",
                niveau: "total",
                valeurs: { ouverture: 100, dotations: 50, diminutions: null, cloture: 150 },
              },
            ],
            hypotheses: ["essai"],
          },
        ],
      },
      exercice,
      identite,
    });
    const s = XLSX.read(fichier, { type: "array", cellFormula: true }).Sheets["NOTE 3C BIS"];
    expect([s.D21.v, s.F21.v]).toEqual([100, 50]);
    expect(s.H21?.v).toBeUndefined(); // inconnu : vidé, pas zéro
    expect(s.J21.f).toBe("D21+F21-H21"); // clôture du modèle en formule : conservée
    expect(s.D22.f).toBe("SUM(D21:D21)"); // total en formule : conservé
    expect(s.F22.v).toBe(50); // total saisi dans le modèle : écrit
    expect(s.D23.v).toBe(42); // sous « Commentaire » : non touché
    expect(rapport.notesRemplies).toEqual(["NOTE 3C BIS"]);
    expect(rapport.hypotheses).toEqual(["NOTE 3C BIS : essai."]);
  });
});

describe("table de correspondance des notes", () => {
  it("chaque libellé de la table existe dans les notes calculées (pas d'entrée orpheline)", () => {
    const calculees = calculerNotes([], []);
    const orphelines = Object.entries(CORRESPONDANCES_NOTES_2025).flatMap(([numero, corr]) => {
      const libelles = new Set(
        calculees
          .find((n) => n.numero === numero)
          ?.lignes.map((l) => libelleComparable(l.libelle)) ?? [],
      );
      return corr
        .filter((c) => !libelles.has(libelleComparable(c.ligne)))
        .map((c) => `NOTE ${numero} : ${c.ligne}`);
    });
    expect(orphelines).toEqual([]);
  });
});
