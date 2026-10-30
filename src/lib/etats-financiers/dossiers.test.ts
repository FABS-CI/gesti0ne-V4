import { describe, it, expect } from "vitest";

import type { BalanceRow } from "@/lib/compta-api";
import { calculerEtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft } from "@/lib/etats-financiers/tft";
import { calculerNotes } from "@/lib/etats-financiers/notes";
import { assemblerDonnees, type BalanceImportee } from "@/lib/etats-financiers/sources";
import type { EtatsExercice } from "@/lib/etats-financiers/donnees-api";
import type { Controle } from "@/lib/etats-financiers/controles";
import {
  construireContenu,
  etatDossier,
  obstaclesValidation,
  parametresEnregistrement,
  versionEnVigueur,
  VERSION_MODELE,
  VERSION_REGLES,
  type VersionDossier,
} from "@/lib/etats-financiers/dossiers";

const ligne = (compte: string, solde: number): BalanceRow => ({
  compte,
  compte_libelle: "",
  debit: Math.max(solde, 0),
  credit: Math.max(-solde, 0),
  solde,
});

// Petit exercice équilibré : capital 1 000 000, banque, ventes et achats.
const cumul = [
  ligne("101", -1_000_000),
  ligne("521", 1_300_000),
  ligne("701", -500_000),
  ligne("601", 200_000),
];

function etats(balanceImportee: BalanceImportee | null = null): EtatsExercice {
  const donnees = assemblerDonnees({
    erp: { cumul, periode: cumul, ouverture: [], ecrituresPeriode: 4, ecrituresAvant: 0 },
    importN: balanceImportee,
    importN1: null,
  });
  const ef = calculerEtatsFinanciers(donnees.cumul, donnees.periode);
  const ouvertureEf = calculerEtatsFinanciers(donnees.ouverture, []);
  return {
    ...ef,
    tft: calculerTft(ouvertureEf, ef, donnees.periode),
    notes: calculerNotes(donnees.cumul, donnees.periode),
    donnees,
    ouvertureEf,
    completude: null,
    balanceImportee,
  };
}

const exercice = { exercice_id: "e2026", date_debut: "2026-01-01", date_fin: "2026-12-31" };
const exerciceN1 = { exercice_id: "e2025", date_debut: "2025-01-01", date_fin: "2025-12-31" };
const controles: Controle[] = [
  { niveau: "avertissement", code: "tva", message: "TVA à vérifier" },
  { niveau: "info", code: "source", message: "Écritures de l'ERP" },
];

const version = (v: Partial<VersionDossier>): VersionDossier => ({
  dossier_id: `d${v.version ?? 1}`,
  version: 1,
  statut: "brouillon",
  preparation: "a_verifier",
  nb_bloquants: 0,
  nb_avertissements: 1,
  source: "erp",
  version_modele: VERSION_MODELE,
  version_regles: VERSION_REGLES,
  empreinte: "abc",
  genere_le: "2026-10-30T09:00:00Z",
  genere_par_nom: "Comptable",
  valide_le: null,
  valide_par_nom: null,
  commentaire_validation: null,
  devalide_le: null,
  devalide_par_nom: null,
  motif_devalidation: null,
  ...v,
});

describe("construireContenu — version figée du dossier", () => {
  const n = etats({
    lotId: "lot-1",
    fichier: "balance.xlsx",
    importeLe: "2026-01-15",
    avecMouvements: false,
    lignes: [{ compte: "101", libelle: null, solde: -1, mvt_debit: null, mvt_credit: null }],
  });
  const contenu = construireContenu({
    exercice,
    exerciceN1,
    libelle: (e) => e.date_fin.slice(0, 4),
    n,
    n1: null,
    controles,
    identite: { ncc: { valeur: "2302562N", origine: "fne" } },
  });

  it("garde les états, les contrôles, l'identité et les exercices", () => {
    expect(contenu.exercice).toEqual({ ...exercice, libelle: "2026" });
    expect(contenu.exerciceN1?.libelle).toBe("2025");
    expect(contenu.n.passif).toEqual(n.passif);
    expect(contenu.n.resultat).toEqual(n.resultat);
    expect(contenu.n.donnees.cumul).toEqual(cumul);
    expect(contenu.n1).toBeNull();
    expect(contenu.controles).toEqual(controles);
    expect(contenu.identite.ncc.valeur).toBe("2302562N");
  });

  it("ne garde de la balance importée que sa référence", () => {
    expect(contenu.n.balanceImportee).toEqual({
      lotId: "lot-1",
      fichier: "balance.xlsx",
      importeLe: "2026-01-15",
    });
  });

  it("passe en JSON sans perte (stockage jsonb)", () => {
    // Seul -0 (sans effet sur un montant) redevient 0 ; aucun NaN, aucun champ perdu.
    const sansMoinsZero = (v: unknown): unknown =>
      Object.is(v, -0)
        ? 0
        : Array.isArray(v)
          ? v.map(sansMoinsZero)
          : v && typeof v === "object"
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sansMoinsZero(x)]))
            : v;
    expect(JSON.parse(JSON.stringify(contenu))).toEqual(sansMoinsZero(contenu));
  });

  it("paramètres d'enregistrement : statut et compte des contrôles", () => {
    const p = parametresEnregistrement(contenu);
    expect(p).toMatchObject({
      p_exercice_id: "e2026",
      p_preparation: "a_verifier",
      p_nb_bloquants: 0,
      p_nb_avertissements: 1,
      p_source: "erp",
      p_version_modele: VERSION_MODELE,
      p_version_regles: VERSION_REGLES,
    });
    const bloque = parametresEnregistrement({
      ...contenu,
      controles: [...controles, { niveau: "bloquant", code: "bilan", message: "Déséquilibré" }],
    });
    expect(bloque.p_preparation).toBe("incomplet");
    expect(bloque.p_nb_bloquants).toBe(1);
  });
});

describe("état du dossier et validation", () => {
  it("aucune version : rien à valider", () => {
    const e = etatDossier([], "abc");
    expect(e.etape).toBe("aucun");
    expect(obstaclesValidation(e)).toEqual(["Aucun dossier généré."]);
  });

  it("la version validée l'emporte sur les versions dévalidées et remplacées", () => {
    const versions = [
      version({ version: 3, statut: "valide" }),
      version({ version: 2, statut: "devalide" }),
      version({ version: 1, statut: "remplace" }),
    ];
    expect(versionEnVigueur(versions)?.version).toBe(3);
    expect(etatDossier(versions, "abc").etape).toBe("valide");
  });

  it("sans version validée : le dernier brouillon", () => {
    const versions = [
      version({ version: 2, statut: "brouillon" }),
      version({ version: 1, statut: "devalide" }),
    ];
    expect(versionEnVigueur(versions)?.version).toBe(2);
  });

  it("brouillon à jour sans bloquant : validable", () => {
    const e = etatDossier([version({})], "abc");
    expect(e).toMatchObject({ etape: "brouillon", aJour: true });
    expect(obstaclesValidation(e)).toEqual([]);
  });

  it("données modifiées depuis la génération : à régénérer", () => {
    const e = etatDossier([version({})], "autre");
    expect(e).toMatchObject({ aJour: false });
    expect(obstaclesValidation(e)).toHaveLength(1);
    expect(obstaclesValidation(e)[0]).toMatch(/régénérer/);
  });

  it("empreinte illisible : pas de conclusion sur la fraîcheur", () => {
    expect(etatDossier([version({})], null)).toMatchObject({ aJour: null });
  });

  it("contrôles bloquants : non validable", () => {
    const e = etatDossier([version({ nb_bloquants: 2, preparation: "incomplet" })], "abc");
    expect(obstaclesValidation(e)[0]).toMatch(/2 contrôle\(s\) bloquant/);
  });

  it("dossier validé : déjà validé, même si les données ont changé depuis", () => {
    const e = etatDossier([version({ statut: "valide" })], "autre");
    expect(e).toMatchObject({ etape: "valide", aJour: false });
    expect(obstaclesValidation(e)).toEqual(["Le dossier est déjà validé."]);
  });
});
