// Montants des déclarations CNPS / ITS / DISA lus sur les bulletins enregistrés
// (bulletin_lignes) : aucun recalcul, pour que les montants déclarés soient
// exactement ceux retenus sur les bulletins émis.

export type LigneBulletinEnregistree = {
  numero_rubrique: string | null;
  code: string | null;
  designation: string | null;
  libelle: string | null;
  bloc: string | null;
  retenue: number | null;
};

export type BulletinDeclare = {
  bulletin_id: string;
  employe_nom: string | null;
  statut: string | null;
  salaire_brut: number | null;
  brut_imposable: number | null;
  salaire_net: number | null;
  net_a_payer: number | null;
  bulletin_lignes: LigneBulletinEnregistree[] | null;
};

export type DeclLigne = {
  employe: string;
  /** Brut imposable (assiette CNPS / ITS). */
  brut: number;
  cnpsSalarie: number;
  /** Retraite, part patronale. */
  cnpsPatronal: number;
  /** Prestations familiales + maternité + accidents du travail. */
  pfAt: number;
  /** ITS, plus l'IGR des bulletins du régime 2022. */
  its: number;
  cn: number;
  cmuSalarie: number;
  cmuPatronal: number;
  net: number;
};

export type DeclTotaux = Omit<DeclLigne, "employe">;

const num = (v: unknown) => Number(v) || 0;

/** Bulletins annulés exclus, comme dans les rapports de paie. */
export const estDeclarable = (b: Pick<BulletinDeclare, "statut">) => !/annul/i.test(b.statut ?? "");

type Poste = Exclude<keyof DeclLigne, "employe" | "brut" | "net">;

// Numéros des rubriques écrites par paie_calculer_bulletin, et anciens codes du moteur précédent.
const PAR_CODE: Record<string, Poste> = {
  "469": "cnpsSalarie",
  CNPS_SAL: "cnpsSalarie",
  "470": "cmuSalarie",
  CMU_SAL: "cmuSalarie",
  "401": "its",
  "431": "its",
  ITS: "its",
  "420": "cn",
  CN: "cn",
  CNPS_PAT: "cnpsPatronal",
  PF: "pfAt",
  AT: "pfAt",
  CMU_PAT: "cmuPatronal",
};

/** Charges patronales : enregistrées sans numéro de rubrique, reconnues par leur libellé. */
function postePatronal(libelle: string): Poste | null {
  const l = libelle.toLowerCase();
  if (l.includes("cmu")) return "cmuPatronal";
  if (l.includes("retraite")) return "cnpsPatronal";
  if (l.includes("prestations familiales") || l.includes("maternit") || l.includes("accident")) {
    return "pfAt";
  }
  return null; // FDFP : taxe de formation, hors déclaration CNPS.
}

export function declLigneDepuisBulletin(b: BulletinDeclare): DeclLigne {
  const d: DeclLigne = {
    employe: b.employe_nom ?? "—",
    brut: num(b.brut_imposable ?? b.salaire_brut),
    cnpsSalarie: 0,
    cnpsPatronal: 0,
    pfAt: 0,
    its: 0,
    cn: 0,
    cmuSalarie: 0,
    cmuPatronal: 0,
    net: num(b.net_a_payer ?? b.salaire_net),
  };
  for (const l of b.bulletin_lignes ?? []) {
    const code = (l.numero_rubrique || l.code || "").trim();
    const poste =
      l.bloc === "patronal"
        ? postePatronal(l.designation ?? l.libelle ?? "")
        : (PAR_CODE[code] ?? null);
    if (poste) d[poste] += num(l.retenue);
  }
  return d;
}

export function computeLignes(bulletins: BulletinDeclare[] | undefined): DeclLigne[] {
  return (bulletins ?? []).filter(estDeclarable).map(declLigneDepuisBulletin);
}

export function computeTotaux(lignes: DeclLigne[]): DeclTotaux {
  const t: DeclTotaux = {
    brut: 0,
    cnpsSalarie: 0,
    cnpsPatronal: 0,
    pfAt: 0,
    its: 0,
    cn: 0,
    cmuSalarie: 0,
    cmuPatronal: 0,
    net: 0,
  };
  for (const l of lignes) {
    for (const k of Object.keys(t) as (keyof DeclTotaux)[]) t[k] += l[k];
  }
  return t;
}

/** Périodes distinctes, de la plus récente à la plus ancienne (par date de fin, pas par libellé). */
export function periodesTriees(rows: { periode: string | null; date_fin: string | null }[]): string[] {
  const fin = new Map<string, string>();
  for (const r of rows) {
    if (!r.periode) continue;
    const prev = fin.get(r.periode);
    if (prev === undefined || (r.date_fin ?? "") > prev) fin.set(r.periode, r.date_fin ?? "");
  }
  return [...fin.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([p]) => p);
}
