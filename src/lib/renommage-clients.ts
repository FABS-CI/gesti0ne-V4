/**
 * Renommage en masse des clients « école / institution » → « LIBRAIRIE|PAPETERIE + représentant ».
 * Module pur : aucune écriture. La prévisualisation est calculée ici, l'application passe par
 * les RPC `renommage_clients_*` (journal + annulation).
 */

export type RenommageStatut = "renomme" | "doublon" | "manuel" | "verifier" | "non_concerne";

export const STATUT_LABEL: Record<RenommageStatut, string> = {
  renomme: "Renommé",
  doublon: "Doublon résolu",
  manuel: "À traiter manuellement",
  verifier: "À vérifier",
  non_concerne: "Non concerné",
};

export type RenommageSource = {
  client_id: string;
  reference: string;
  nom: string;
  ancien_nom?: string | null;
  representant: string | null;
  type_renommage?: string | null;
};

export type RenommageLigne = {
  client_id: string;
  reference: string;
  ancien_nom: string;
  nom_actuel: string;
  representant: string;
  nouveau_nom: string | null;
  type: "LIBRAIRIE" | "PAPETERIE" | null;
  ville_detectee: string;
  statut: RenommageStatut;
  raison: string;
};

export const PREFIXES_ECOLE = [
  "LYC", "COL", "IEP", "EPP", "GSC", "CAT", "MEM", "ISP", "DRN", "INS", "UPE", "MET", "ECO",
];

/** Mots-clés (déjà normalisés : majuscules, sans accent, sans point). */
const KEYWORDS: string[][] = [
  "LYCEE", "LYCE", "LYCCE", "COLLEGE", "COLEGE", "COLLEG", "GROUPE SCOLAIRE", "GS", "GSP", "EPP",
  "IEP", "EPC", "EMPT", "ECOLE", "INSTITUT", "COURS SECONDAIRE", "ORPHELINAT",
  "CRD", "APFC", "DREN", "DDEC", "SEDEC", "INSPECTEUR", "INSPECTRICE", "INSPECTION",
  "DIOCESE", "CATHOLIQUE", "MEMO",
  "WILLIAM PONTY", "PIERRE GADIE", "DJEDJE AMONDJI", "DJEDJI AMONDJI", "HARRIS", "HARRIST",
  "ABIDJAN 4", "ANTENNE",
].map((k) => k.split(" "));
/** LM, LM1, LM2, CM, CM1… */
const KW_PATTERN = /^(LM|CM)\d*$/;

const LIAISON = new Set([
  "MODERNE", "MUNICIPAL", "MUNICIPALE", "PRIVE", "PRIVEE", "DE", "DU", "D", "DES", "LA", "LE", "LES",
  "SAINT", "SAINTE", "ST", "STE",
]);
const EXCLU_DEBUT = ["LIBRAIRIE", "LIBRAIRE", "LIBRARIE", "PAPETERIE"];
const REP_GENERIQUES = new Set([
  "", "-", "—", "DIRECTEUR", "DIRECTRICE", "INSPECTEUR", "INSPECTRICE", "PARENT D ELEVE",
  "PARENT D ELEVES", "PARENTS D ELEVES", "RESPONSABLE ACHAT", "RESPONSABLE ACHATS", "PROFESSEUR",
]);
const SOCIETE = /\b(INFORMATIQUE|SARL|SA|SAS|ENTREPRISE|GROUP|GROUPE|DISTRIBUTION|ETS|FRERES|SERVICES|CI|COMPANY|CORP|TRADING)\b/;

export function normaliser(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Positions [début, longueur] des mots-clés trouvés (mots entiers). */
function trouverMotsCles(tokens: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < tokens.length; i++) {
    if (KW_PATTERN.test(tokens[i])) { out.push([i, 1]); continue; }
    let best = 0;
    for (const kw of KEYWORDS) {
      if (kw.length > best && kw.every((w, j) => tokens[i + j] === w)) best = kw.length;
    }
    if (best) { out.push([i, best]); i += best - 1; }
  }
  return out;
}

export function contientMotCle(nom: string): boolean {
  return trouverMotsCles(normaliser(nom).split(" ").filter(Boolean)).length > 0;
}
export function commenceParMotCle(nom: string): boolean {
  const k = trouverMotsCles(normaliser(nom).split(" ").filter(Boolean));
  return k.length > 0 && k[0][0] === 0;
}

export function villeDetectee(nom: string): string {
  const tokens = normaliser(nom).split(" ").filter(Boolean);
  const kws = trouverMotsCles(tokens);
  if (kws.length === 0) return tokens.join(" ");
  const drop = new Set<number>();
  for (const [i, n] of kws) for (let j = 0; j < n; j++) drop.add(i + j);
  // mots de liaison qui suivent directement un mot-clé supprimé (préfixe)
  for (const [i, n] of kws) {
    let j = i + n;
    while (j < tokens.length && LIAISON.has(tokens[j])) { drop.add(j); j++; }
  }
  const rest = tokens.filter((_, i) => !drop.has(i));
  while (rest.length && LIAISON.has(rest[0])) rest.shift();
  while (rest.length && LIAISON.has(rest[rest.length - 1])) rest.pop();
  return rest.join(" ");
}

/** Hash déterministe (FNV-1a 32 bits) : pair = LIBRAIRIE, impair = PAPETERIE. */
export function typePourReference(reference: string): "LIBRAIRIE" | "PAPETERIE" {
  let h = 0x811c9dc5;
  for (let i = 0; i < reference.length; i++) {
    h ^= reference.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 === 0 ? "LIBRAIRIE" : "PAPETERIE";
}

export function prefixeReference(reference: string): string {
  return (reference.match(/^CL-([A-Z]{3})-/)?.[1] ?? "").toUpperCase();
}

export function nettoyerRepresentant(rep: string | null | undefined): string {
  return (rep ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function compareRef(a: string, b: string) {
  return a.localeCompare(b, "fr", { numeric: true });
}

/** Calcule la prévisualisation complète (règles des sections 3 à 6). */
export function calculerRenommage(
  clients: RenommageSource[],
  exclusions: Iterable<string> = [],
): RenommageLigne[] {
  const exclus = new Set([...exclusions].map((r) => r.trim().toUpperCase()));
  const sorted = [...clients].sort((a, b) => compareRef(a.reference, b.reference));

  const lignes: RenommageLigne[] = sorted.map((c) => {
    const ancien = (c.ancien_nom ?? c.nom).trim();
    const rep = nettoyerRepresentant(c.representant);
    const base: RenommageLigne = {
      client_id: c.client_id,
      reference: c.reference,
      ancien_nom: ancien,
      nom_actuel: c.nom,
      representant: rep,
      nouveau_nom: null,
      type: null,
      ville_detectee: villeDetectee(ancien),
      statut: "non_concerne",
      raison: "",
    };
    const nomN = normaliser(ancien);
    const pref = prefixeReference(c.reference);

    if (exclus.has(c.reference.toUpperCase())) return { ...base, raison: "Liste d'exclusion manuelle" };
    if (EXCLU_DEBUT.some((w) => nomN === w || nomN.startsWith(w + " ")))
      return { ...base, raison: "Nom commençant par LIBRAIRIE / PAPETERIE" };

    const hasKw = contientMotCle(ancien);
    let concerne = false;
    let parRefSeule = false;
    if (pref === "LIB" || pref === "AUT") {
      concerne = commenceParMotCle(ancien);
      if (!concerne) return { ...base, raison: "Librairie (CL-" + pref + ")" };
    } else if (PREFIXES_ECOLE.includes(pref)) {
      concerne = true;
      parRefSeule = !hasKw;
    } else if (hasKw) {
      concerne = true;
    }
    if (!concerne) return { ...base, raison: "Aucun mot-clé d'école" };

    const repN = normaliser(rep);
    if (REP_GENERIQUES.has(repN) || /^PROF(ESSEUR)?$/.test(repN))
      return { ...base, statut: "manuel", raison: rep ? "Représentant générique" : "Représentant vide" };
    if (parRefSeule && (SOCIETE.test(repN) || SOCIETE.test(nomN)))
      return { ...base, statut: "verifier", raison: "Référence d'école mais nom/représentant de société" };

    const type =
      c.type_renommage === "LIBRAIRIE" || c.type_renommage === "PAPETERIE"
        ? c.type_renommage
        : typePourReference(c.reference);
    return { ...base, statut: "renomme", type, nouveau_nom: `${type} ${rep}`, raison: "" };
  });

  // Doublons : noms déjà pris par les clients non renommés, puis 1er arrivé garde le nom simple.
  const pris = new Set(
    lignes.filter((l) => l.statut !== "renomme").map((l) => normaliser(l.nom_actuel)),
  );
  for (const l of lignes) {
    if (l.statut !== "renomme" || !l.nouveau_nom) continue;
    let nom = l.nouveau_nom;
    if (pris.has(normaliser(nom))) {
      if (l.ville_detectee && !normaliser(nom).endsWith(l.ville_detectee)) {
        nom = `${l.nouveau_nom} ${l.ville_detectee}`;
      }
      let n = 2;
      while (pris.has(normaliser(nom))) nom = `${l.nouveau_nom} ${n++}`;
      l.statut = "doublon";
      l.raison = "Même nom qu'un autre client";
    }
    l.nouveau_nom = nom;
    pris.add(normaliser(nom));
  }
  return lignes;
}

export function compterStatuts(lignes: RenommageLigne[]) {
  const c: Record<RenommageStatut, number> = {
    renomme: 0, doublon: 0, manuel: 0, verifier: 0, non_concerne: 0,
  };
  for (const l of lignes) c[l.statut]++;
  return c;
}
