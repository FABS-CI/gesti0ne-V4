// Moteur de paie Côte d'Ivoire versionné par régime (REGIME_2024 défaut, REGIME_2022 historique).
// Fonctions pures : tous les taux/plafonds viennent de RegimeParams (éditables en Paramètres paie).

export type RegimeCode = "REGIME_2024" | "REGIME_2022";
export type Bloc = "imposable" | "retenue" | "non_imposable" | "arrondi" | "patronal";

export interface Tranche { max: number; taux: number } // taux en %

export interface RegimeParams {
  code: RegimeCode;
  itsBareme: Tranche[]; // 2024 : barème progressif
  itsTauxForfait: number; // 2022 : ITS = taux % du brut imposable
  ricfParDemiPart: number;
  crTaux: number; crPlafond: number;
  cmuSalarie: number; cmuPatronal: number;
  transportPlafond: number;
  arrondiUnite: number;
  retraitePatTaux: number; retraitePatPlafond: number;
  pfTaux: number; maternTaux: number; atTaux: number; plafondPrestations: number;
  fdfpActif: boolean; fdfpTaux: number;
  cnAbattement: number; cnBareme: Tranche[];
}

export const REGIME_2024: RegimeParams = {
  code: "REGIME_2024",
  itsBareme: [
    { max: 75000, taux: 0 }, { max: 240000, taux: 16 }, { max: 800000, taux: 21 },
    { max: 2400000, taux: 24 }, { max: 8000000, taux: 28 }, { max: Infinity, taux: 32 },
  ],
  itsTauxForfait: 0,
  ricfParDemiPart: 5500,
  crTaux: 6.3, crPlafond: 3375000,
  cmuSalarie: 500, cmuPatronal: 500,
  transportPlafond: 30000,
  arrondiUnite: 100,
  retraitePatTaux: 7.7, retraitePatPlafond: 3375000,
  pfTaux: 5, maternTaux: 0.75, atTaux: 2, plafondPrestations: 70000,
  fdfpActif: false, fdfpTaux: 0,
  cnAbattement: 0, cnBareme: [],
};

export const REGIME_2022: RegimeParams = {
  ...REGIME_2024,
  code: "REGIME_2022",
  itsBareme: [],
  itsTauxForfait: 1.2,
  ricfParDemiPart: 0,
  cnAbattement: 80,
  cnBareme: [
    { max: 50000, taux: 0 }, { max: 130000, taux: 1.5 }, { max: 200000, taux: 5 }, { max: Infinity, taux: 10 },
  ],
};

/** Régime applicable selon la date de fin de période (ISO yyyy-mm-dd). */
export function regimePourDate(dateFin: string): RegimeCode {
  return dateFin < "2024-01-01" ? "REGIME_2022" : "REGIME_2024";
}

export function bareme(base: number, tranches: Tranche[]): number {
  let total = 0, prev = 0;
  for (const t of tranches) {
    if (base <= prev) break;
    total += (Math.min(base, t.max) - prev) * (t.taux / 100);
    prev = t.max;
  }
  return total;
}

/** Parts : pas de 0,5, entre 1 et 5. */
export function normaliserParts(parts: number): number {
  const p = Math.round((parts || 1) * 2) / 2;
  return Math.min(5, Math.max(1, p));
}

export function ricf(parts: number, parDemiPart: number): number {
  return Math.round((normaliserParts(parts) - 1) * 2) * parDemiPart;
}

export function its2024(brutImposable: number, parts: number, p: RegimeParams = REGIME_2024) {
  const brut = Math.round(bareme(brutImposable, p.itsBareme));
  const reduction = ricf(parts, p.ricfParDemiPart);
  return { itsBrut: brut, ricf: reduction, its: Math.max(0, Math.round(brut - reduction)) };
}

/** CN 2022 : base = 80 % du brut imposable arrondi au millier inférieur. */
export function cn2022(brutImposable: number, p: RegimeParams = REGIME_2022): number {
  const base = Math.floor(brutImposable / 1000) * 1000 * (p.cnAbattement / 100);
  return Math.round(bareme(base, p.cnBareme));
}

/** IGR 2022 : formule à compléter (renvoie 0 tant qu'elle n'est pas fournie). */
export function igr2022(_brutImposable: number, _parts: number): number {
  return 0;
}

export interface SaisieBulletin {
  salaireBase: number;
  sursalaire?: number;
  tauxAnciennete?: number; // % du salaire de base
  autresGainsImposables?: number;
  transport?: number;
  autresIndemnitesNonImposables?: number;
  autresRetenues?: number;
  parts: number;
  joursTravailles?: number;
  /** Uniquement pour REGIME_2022 tant que la formule IGR n'est pas fournie. */
  igrManuel?: number;
}

export interface LigneCalc {
  numero: string; designation: string; nombre: number | null; base: number | null;
  taux: number | null; gain: number; retenue: number; bloc: Bloc; ordre: number;
}

export interface ResultatBulletin {
  regime: RegimeCode;
  lignes: LigneCalc[];
  brutImposable: number;
  itsBrut: number; ricf: number; its: number; cn: number; igr: number; cr: number; cmu: number;
  totalRetenuesFiscalesSociales: number;
  totalIndemnitesNonImposables: number;
  totalAutresRetenues: number;
  netAvantArrondi: number; arrondi: number; netAPayer: number;
  patronal: { retraite: number; pf: number; maternite: number; at: number; cmu: number; fdfp: number; total: number };
  coutSalarial: number;
}

const r = Math.round;

export function calculerBulletin(s: SaisieBulletin, p: RegimeParams): ResultatBulletin {
  const sb = Math.max(0, s.salaireBase || 0);
  const sur = Math.max(0, s.sursalaire || 0);
  const anc = r(sb * (s.tauxAnciennete || 0) / 100);
  const autres = Math.max(0, s.autresGainsImposables || 0);
  const transport = Math.max(0, s.transport || 0);
  const transportExo = Math.min(transport, p.transportPlafond);
  const transportExces = transport - transportExo;
  const brutImposable = sb + sur + anc + autres + transportExces;
  const nonImpo = transportExo + Math.max(0, s.autresIndemnitesNonImposables || 0);
  const autresRet = Math.max(0, s.autresRetenues || 0);

  let itsBrut = 0, ricfV = 0, its = 0, cn = 0, igr = 0;
  if (p.code === "REGIME_2024") {
    ({ itsBrut, ricf: ricfV, its } = its2024(brutImposable, s.parts, p));
  } else {
    its = r(brutImposable * p.itsTauxForfait / 100);
    itsBrut = its;
    cn = cn2022(brutImposable, p);
    igr = s.igrManuel ?? igr2022(brutImposable, s.parts);
  }
  const cr = r(Math.min(brutImposable, p.crPlafond) * p.crTaux / 100);
  const cmu = p.cmuSalarie;
  const totalFS = its + cn + igr + cr;
  const netAvant = brutImposable - totalFS - cmu - autresRet + nonImpo;
  const unite = p.arrondiUnite > 0 ? p.arrondiUnite : 1;
  const netAPayer = Math.round(netAvant / unite) * unite;
  const arrondi = netAPayer - netAvant;

  const plafP = Math.min(brutImposable, p.plafondPrestations);
  const pat = {
    retraite: r(Math.min(brutImposable, p.retraitePatPlafond) * p.retraitePatTaux / 100),
    pf: r(plafP * p.pfTaux / 100),
    maternite: r(plafP * p.maternTaux / 100),
    at: r(plafP * p.atTaux / 100),
    cmu: p.cmuPatronal,
    fdfp: p.fdfpActif ? r(brutImposable * p.fdfpTaux / 100) : 0,
    total: 0,
  };
  pat.total = pat.retraite + pat.pf + pat.maternite + pat.at + pat.cmu + pat.fdfp;

  const L: LigneCalc[] = [];
  let o = 0;
  const add = (l: Omit<LigneCalc, "ordre">) => L.push({ ...l, ordre: ++o });
  add({ numero: "150", designation: "Salaire de base", nombre: s.joursTravailles ?? 30, base: sb, taux: null, gain: sb, retenue: 0, bloc: "imposable" });
  if (sur) add({ numero: "153", designation: "Sursalaire", nombre: null, base: null, taux: null, gain: sur, retenue: 0, bloc: "imposable" });
  if (anc) add({ numero: "154", designation: "Prime d'ancienneté", nombre: null, base: sb, taux: s.tauxAnciennete ?? 0, gain: anc, retenue: 0, bloc: "imposable" });
  if (autres) add({ numero: "160", designation: "Autres gains imposables", nombre: null, base: null, taux: null, gain: autres, retenue: 0, bloc: "imposable" });
  if (transportExces) add({ numero: "503", designation: "Excédent indemnité de transport", nombre: null, base: null, taux: null, gain: transportExces, retenue: 0, bloc: "imposable" });
  add({ numero: "413", designation: "I.T.S", nombre: null, base: brutImposable, taux: p.code === "REGIME_2022" ? p.itsTauxForfait : null, gain: 0, retenue: its, bloc: "retenue" });
  if (p.code === "REGIME_2022") {
    add({ numero: "420", designation: "C.N", nombre: null, base: brutImposable, taux: null, gain: 0, retenue: cn, bloc: "retenue" });
    add({ numero: "431", designation: "I.G.R", nombre: null, base: brutImposable, taux: null, gain: 0, retenue: igr, bloc: "retenue" });
  }
  add({ numero: "469", designation: "C.R", nombre: null, base: Math.min(brutImposable, p.crPlafond), taux: p.crTaux, gain: 0, retenue: cr, bloc: "retenue" });
  if (transportExo) add({ numero: "503", designation: "Indemnité de transport", nombre: null, base: null, taux: null, gain: transportExo, retenue: 0, bloc: "non_imposable" });
  if (s.autresIndemnitesNonImposables) add({ numero: "510", designation: "Autres indemnités non imposables", nombre: null, base: null, taux: null, gain: s.autresIndemnitesNonImposables, retenue: 0, bloc: "non_imposable" });
  add({ numero: "776", designation: "Retenue CMU", nombre: null, base: null, taux: null, gain: 0, retenue: cmu, bloc: "non_imposable" });
  if (autresRet) add({ numero: "780", designation: "Autres retenues", nombre: null, base: null, taux: null, gain: 0, retenue: autresRet, bloc: "non_imposable" });
  add({ numero: "900", designation: "Arrondi de paie", nombre: null, base: null, taux: null, gain: arrondi > 0 ? arrondi : 0, retenue: arrondi < 0 ? -arrondi : 0, bloc: "arrondi" });
  const patL: [string, number][] = [["Retraite (part patronale)", pat.retraite], ["Prestations familiales", pat.pf], ["Maternité", pat.maternite], ["Accidents du travail", pat.at], ["CMU patronale", pat.cmu], ["Taxes de formation (FDFP)", pat.fdfp]];
  for (const [d, m] of patL) if (m) add({ numero: "", designation: d, nombre: null, base: null, taux: null, gain: 0, retenue: m, bloc: "patronal" });

  return {
    regime: p.code, lignes: L, brutImposable, itsBrut, ricf: ricfV, its, cn, igr, cr, cmu,
    totalRetenuesFiscalesSociales: totalFS, totalIndemnitesNonImposables: nonImpo,
    totalAutresRetenues: autresRet, netAvantArrondi: netAvant, arrondi, netAPayer,
    patronal: pat, coutSalarial: brutImposable + nonImpo + pat.total,
  };
}

type Bar = Array<[number | null, number]>;
const toTranches = (b: unknown): Tranche[] =>
  Array.isArray(b) ? (b as Bar).map(([max, taux]) => ({ max: max ?? Infinity, taux })) : [];

/** Convertit les paramètres enregistrés (paie_regimes.parametres) en RegimeParams. */
export function regimeDepuisParametres(code: RegimeCode, j: Record<string, unknown> | null | undefined): RegimeParams {
  const base = code === "REGIME_2022" ? REGIME_2022 : REGIME_2024;
  if (!j) return base;
  const n = (k: string, d: number) => (typeof j[k] === "number" ? (j[k] as number) : d);
  return {
    ...base,
    itsBareme: j["its_bareme"] ? toTranches(j["its_bareme"]) : base.itsBareme,
    itsTauxForfait: n("its_taux_forfait", base.itsTauxForfait),
    ricfParDemiPart: n("ricf_par_demi_part", base.ricfParDemiPart),
    crTaux: n("cr_taux", base.crTaux), crPlafond: n("cr_plafond", base.crPlafond),
    cmuSalarie: n("cmu_salarie", base.cmuSalarie), cmuPatronal: n("cmu_patronal", base.cmuPatronal),
    transportPlafond: n("transport_plafond", base.transportPlafond),
    arrondiUnite: n("arrondi_unite", base.arrondiUnite),
    retraitePatTaux: n("retraite_pat_taux", base.retraitePatTaux), retraitePatPlafond: n("retraite_pat_plafond", base.retraitePatPlafond),
    pfTaux: n("pf_taux", base.pfTaux), maternTaux: n("maternite_taux", base.maternTaux), atTaux: n("at_taux", base.atTaux),
    plafondPrestations: n("plafond_prestations", base.plafondPrestations),
    fdfpActif: typeof j["fdfp_actif"] === "boolean" ? (j["fdfp_actif"] as boolean) : base.fdfpActif,
    fdfpTaux: n("fdfp_taux", base.fdfpTaux),
    cnAbattement: n("cn_abattement", base.cnAbattement),
    cnBareme: j["cn_bareme"] ? toTranches(j["cn_bareme"]) : base.cnBareme,
  };
}
