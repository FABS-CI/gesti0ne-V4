import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { callRpc } from "@/lib/rpc";

export type LigneCompta = {
  ligne_id: string;
  ecriture_id: string;
  compte: string;
  compte_libelle: string;
  debit: number;
  credit: number;
  date_ecriture: string;
  journal: string;
  libelle: string;
  reference: string;
};

export type BalanceRow = {
  compte: string;
  compte_libelle: string;
  debit: number;
  credit: number;
  solde: number;
};

export async function getLignesPeriode(from?: string, to?: string, exerciceId?: string | null) {
  // Auto-pagination via range() par chunks de 1000 — supprime le plafond dur de 5000
  // sans surcharger le worker (Supabase limite à 1000 lignes par requête).
  const CHUNK = 1000;
  const MAX_ROWS = 100_000; // garde-fou
  type Row = {
    ligne_id: string;
    ecriture_id: string;
    compte: string;
    compte_libelle: string;
    debit: number | null;
    credit: number | null;
    ecritures_comptables: {
      date_ecriture: string | null;
      journal: string | null;
      libelle: string | null;
      reference: string | null;
    } | null;
  };
  const all: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    let q = supabase
      .from("ecriture_lignes")
      .select(
        "ligne_id, ecriture_id, compte, compte_libelle, debit, credit, ecritures_comptables!inner(date_ecriture, journal, libelle, reference)",
      );
    if (from) q = q.gte("ecritures_comptables.date_ecriture", from);
    if (to) q = q.lte("ecritures_comptables.date_ecriture", to);
    if (exerciceId) q = q.eq("ecritures_comptables.exercice_id", exerciceId);
    const { data, error } = await q.range(offset, offset + CHUNK - 1);
    if (error) throw error;
    const batch = (data ?? []) as Row[];
    all.push(...batch);
    if (batch.length < CHUNK) break;
  }
  return all.map((r) => ({
    ligne_id: r.ligne_id,
    ecriture_id: r.ecriture_id,
    compte: r.compte,
    compte_libelle: r.compte_libelle,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    date_ecriture: r.ecritures_comptables?.date_ecriture ?? "",
    journal: r.ecritures_comptables?.journal ?? "",
    libelle: r.ecritures_comptables?.libelle ?? "",
    reference: r.ecritures_comptables?.reference ?? "",
  })) as LigneCompta[];
}

export async function getBalance(
  from?: string,
  to?: string,
  exerciceId?: string | null,
): Promise<BalanceRow[]> {
  // Agrégation server-side via RPC — évite de transférer toutes les lignes au client.
  const { data, error } = await supabase.rpc("compta_balance", {
    p_from: from,
    p_to: to,
    p_exercice_id: exerciceId ?? undefined,
  });
  if (error) throw error;
  type BalanceRpcRow = Database["public"]["Functions"]["compta_balance"]["Returns"][number];
  return ((data ?? []) as BalanceRpcRow[]).map((r) => ({
    compte: r.numero_compte,
    compte_libelle: r.libelle ?? "",
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    solde: Number(r.solde ?? 0),
  }));
}

export type BalanceExerciceRow = {
  compte: string;
  compte_libelle: string;
  /** Ligne calculée : résultats antérieurs non affectés (report à nouveau). */
  calcule: boolean;
  ouvertureDebit: number;
  ouvertureCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  soldeDebit: number;
  soldeCredit: number;
};

/** Balance d'un exercice à six colonnes, à-nouveaux calculés (RPC 0112). */
export async function getBalanceExercice(exerciceId: string): Promise<BalanceExerciceRow[]> {
  const { data, error } = await callRpc("compta_balance_exercice", { p_exercice_id: exerciceId });
  if (error) throw error;
  type Row = {
    numero_compte: string;
    libelle: string | null;
    calcule: boolean;
    ouverture_debit: number;
    ouverture_credit: number;
    mouvement_debit: number;
    mouvement_credit: number;
    solde_debit: number;
    solde_credit: number;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    compte: r.numero_compte,
    compte_libelle: r.libelle ?? "",
    calcule: r.calcule,
    ouvertureDebit: Number(r.ouverture_debit ?? 0),
    ouvertureCredit: Number(r.ouverture_credit ?? 0),
    mouvementDebit: Number(r.mouvement_debit ?? 0),
    mouvementCredit: Number(r.mouvement_credit ?? 0),
    soldeDebit: Number(r.solde_debit ?? 0),
    soldeCredit: Number(r.solde_credit ?? 0),
  }));
}

export type CompteRow = {
  compte_id: string | null;
  numero: string;
  libelle: string;
  classe: number | null;
  parent_numero: string | null;
  actif: boolean;
  /** false : compte utilisé par des écritures mais absent du plan. */
  dans_plan: boolean;
  nb_lignes: number;
  debit: number;
  credit: number;
  dernier_mouvement: string | null;
};

/** Plan comptable avec mouvements, et comptes utilisés absents du plan (RPC 0113). */
export async function getPlanComptable(): Promise<CompteRow[]> {
  const { data, error } = await callRpc("compta_plan_comptable", {});
  if (error) throw error;
  type Row = Omit<CompteRow, "debit" | "credit" | "nb_lignes"> & {
    nb_lignes: number;
    total_debit: number;
    total_credit: number;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    compte_id: r.compte_id,
    numero: r.numero,
    libelle: r.libelle ?? "",
    classe: r.classe,
    parent_numero: r.parent_numero,
    actif: r.actif,
    dans_plan: r.dans_plan,
    nb_lignes: Number(r.nb_lignes ?? 0),
    debit: Number(r.total_debit ?? 0),
    credit: Number(r.total_credit ?? 0),
    dernier_mouvement: r.dernier_mouvement,
  }));
}

export type DashboardCompta = {
  produits: number; // classe 7
  charges: number; // classe 6
  /** Hors activités ordinaires (classe 8), net. */
  hao: number;
  resultat: number;
  tresorerie: number; // classe 5
  creancesClients: number; // 41
  dettesFournisseurs: number; // 40
};

export async function getDashboardCompta(
  from?: string,
  to?: string,
  exerciceId?: string | null,
): Promise<DashboardCompta> {
  // Résultat : mouvements de la période. Bilan (trésorerie, tiers) : balance cumulée
  // jusqu'à la fin de la période, soldes d'ouverture compris (sans quoi la trésorerie
  // ne montrait que les mouvements de la période).
  const [periode, cumul] = await Promise.all([
    getBalance(from, to, exerciceId),
    getBalance(undefined, to),
  ]);
  let produits = 0,
    charges = 0,
    hao = 0,
    tresorerie = 0,
    creancesClients = 0,
    dettesFournisseurs = 0;
  for (const r of periode) {
    const c = r.compte.trim();
    if (c.startsWith("7")) produits += r.credit - r.debit;
    else if (c.startsWith("6")) charges += r.debit - r.credit;
    else if (c.startsWith("8")) hao += r.credit - r.debit;
  }
  for (const r of cumul) {
    const c = r.compte.trim();
    if (c.startsWith("5")) tresorerie += r.debit - r.credit;
    else if (c.startsWith("41")) creancesClients += r.debit - r.credit;
    else if (c.startsWith("40")) dettesFournisseurs += r.credit - r.debit;
  }
  return {
    produits,
    charges,
    hao,
    resultat: produits - charges + hao,
    tresorerie,
    creancesClients,
    dettesFournisseurs,
  };
}

export type TableauDeBordCompta = {
  periode: { debut: string; fin: string; situation: string };
  ecritures: { total: number; validees: number; brouillons: number; annulees: number };
  mouvements: {
    debit: number;
    credit: number;
    soldes_debiteurs: number;
    soldes_crediteurs: number;
    comptes_mouvementes: number;
  };
  resultat: {
    chiffre_affaires: number;
    produits: number;
    charges: number;
    hao: number;
    resultat: number;
  };
  situation: {
    tresorerie: number;
    creances_clients: number;
    dettes_fournisseurs: number;
    dettes_sociales_fiscales: number;
  };
  mensuel: {
    mois: string;
    chiffre_affaires: number;
    produits: number;
    charges: number;
    resultat: number;
  }[];
  charges_par_compte: { compte: string; libelle: string; montant: number }[];
};

/** Indicateurs d'un exercice, calculés en base (RPC compta_tableau_de_bord, 0114). */
export async function getTableauDeBordCompta(exerciceId: string): Promise<TableauDeBordCompta> {
  const { data, error } = await callRpc("compta_tableau_de_bord", { p_exercice_id: exerciceId });
  if (error) throw error;
  return data as TableauDeBordCompta;
}
