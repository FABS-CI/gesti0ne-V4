import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";


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
  type BalanceRpcRow =
    Database["public"]["Functions"]["compta_balance"]["Returns"][number];
  return ((data ?? []) as BalanceRpcRow[]).map((r) => ({
    compte: r.numero_compte,
    compte_libelle: r.libelle ?? "",
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    solde: Number(r.solde ?? 0),
  }));

}

export type ComptePlan = {
  compte_id: string;
  numero: string;
  libelle: string;
  classe: number;
  type: string;
  parent_numero: string | null;
  actif: boolean;
};

/** Comptes du référentiel SYSCOHADA, dans l'ordre des numéros. */
export async function getPlanComptable(): Promise<ComptePlan[]> {
  const { data, error } = await supabase
    .from("plan_comptable")
    .select("compte_id, numero, libelle, classe, type, parent_numero, actif")
    .order("numero");
  if (error) throw error;
  return (data ?? []) as ComptePlan[];
}

export type DashboardCompta = {
  produits: number; // classe 7
  charges: number; // classe 6
  resultat: number;
  tresorerie: number; // classe 5
  creancesClients: number; // 411
  dettesFournisseurs: number; // 401
};

export async function getDashboardCompta(
  from?: string,
  to?: string,
  exerciceId?: string | null,
): Promise<DashboardCompta> {
  const bal = await getBalance(from, to, exerciceId);
  let produits = 0,
    charges = 0,
    tresorerie = 0,
    creancesClients = 0,
    dettesFournisseurs = 0;
  for (const r of bal) {
    const c = r.compte.trim();
    if (c.startsWith("7")) produits += r.credit - r.debit;
    else if (c.startsWith("6")) charges += r.debit - r.credit;
    else if (c.startsWith("5")) tresorerie += r.debit - r.credit;
    else if (c.startsWith("411")) creancesClients += r.debit - r.credit;
    else if (c.startsWith("401")) dettesFournisseurs += r.credit - r.debit;
  }
  return {
    produits,
    charges,
    resultat: produits - charges,
    tresorerie,
    creancesClients,
    dettesFournisseurs,
  };
}
