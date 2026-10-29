// Accès aux données des états financiers : balance de l'ERP, balances importées,
// contrôles serveur et identification de l'entité. Les droits sont vérifiés en
// base (RPC et RLS) ; l'interface ne fait que refléter ce qui est autorisé.

import { supabase } from "@/integrations/supabase/client";
import { dynFrom } from "@/components/crud/resource-manager-types";
import { getBalance } from "@/lib/compta-api";
import { loadFNESettings } from "@/lib/fne/settings";
import { calculerEtatsFinanciers, type EtatsFinanciers } from "@/lib/etats-financiers/syscohada";
import { calculerTft, type Tft } from "@/lib/etats-financiers/tft";
import { calculerNotes, type NoteCalculee } from "@/lib/etats-financiers/notes";
import {
  assemblerDonnees,
  type BalanceImportee,
  type DonneesExercice,
  type LigneImportee,
} from "@/lib/etats-financiers/sources";
import type { Completude } from "@/lib/etats-financiers/controles";
import {
  CATEGORIE_PARAMETRES,
  CHAMPS_IDENTITE,
  CLE_PARAMETRE,
  resoudreIdentite,
  type ValeurIdentite,
} from "@/lib/etats-financiers/identite";

export type PeriodeExercice = { exercice_id: string; date_debut: string; date_fin: string };

// Tables et RPC de la migration 0103, absentes des types générés tant qu'ils
// ne sont pas régénérés : accès non typé, résultats typés ici.
const table = dynFrom;
const rpc = (fn: string, args: Record<string, unknown>) =>
  supabase.rpc(fn as never, args as never) as unknown as Promise<{
    data: unknown;
    error: Error | null;
  }>;

/** Veille d'une date ISO (AAAA-MM-JJ). */
export function veille(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Exercice précédent : le dernier clos avant le début de celui-ci. */
export function exercicePrecedent<E extends PeriodeExercice>(exercices: E[], e: E): E | null {
  return (
    exercices
      .filter((x) => x.date_fin < e.date_debut)
      .sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null
  );
}

/** Contrôles serveur ; null si la RPC n'est pas encore déployée ou refusée. */
export async function getCompletude(debut: string, fin: string): Promise<Completude | null> {
  const { data, error } = await rpc("etats_financiers_completude", { p_debut: debut, p_fin: fin });
  if (error) return null;
  return data as Completude;
}

/** Lot de balance importée actif d'un exercice, avec toutes ses lignes. */
export async function getBalanceImportee(exerciceId: string): Promise<BalanceImportee | null> {
  const lots = await table("balances_importees_lots")
    .select("lot_id, fichier, importe_le, avec_mouvements")
    .eq("exercice_id", exerciceId)
    .is("remplace_le", null)
    .maybeSingle();
  // Table absente (migration non appliquée) : aucune balance importée.
  if (lots.error || !lots.data) return null;
  const lot = lots.data as unknown as {
    lot_id: string;
    fichier: string | null;
    importe_le: string;
    avec_mouvements: boolean;
  };
  const lignes: LigneImportee[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await table("balances_importees")
      .select("numero_compte, libelle, solde, mvt_debit, mvt_credit")
      .eq("lot_id", lot.lot_id)
      .order("numero_compte")
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      numero_compte: string;
      libelle: string | null;
      solde: number;
      mvt_debit: number | null;
      mvt_credit: number | null;
    }>;
    for (const r of rows)
      lignes.push({
        compte: r.numero_compte,
        libelle: r.libelle,
        solde: Number(r.solde),
        mvt_debit: r.mvt_debit == null ? null : Number(r.mvt_debit),
        mvt_credit: r.mvt_credit == null ? null : Number(r.mvt_credit),
      });
    if (rows.length < 1000) break;
  }
  return {
    lotId: lot.lot_id,
    fichier: lot.fichier,
    importeLe: lot.importe_le,
    avecMouvements: lot.avec_mouvements,
    lignes,
  };
}

export async function importerBalance(
  exerciceId: string,
  fichier: string,
  lignes: LigneImportee[],
) {
  const { data, error } = await rpc("etats_financiers_importer_balance", {
    p_exercice_id: exerciceId,
    p_fichier: fichier,
    p_lignes: lignes,
  });
  if (error) throw error;
  return data as string;
}

export type EtatsExercice = EtatsFinanciers & {
  tft: Tft;
  notes: NoteCalculee[];
  donnees: DonneesExercice;
  /** Bilan calculé sur les soldes d'ouverture. */
  ouvertureEf: EtatsFinanciers;
  completude: Completude | null;
  balanceImportee: BalanceImportee | null;
};

/** Calcule les états d'un exercice à partir des meilleures données disponibles. */
export async function chargerExercice(
  e: PeriodeExercice,
  precedent: PeriodeExercice | null,
): Promise<EtatsExercice> {
  const [ouverture, cumul, periode, completude, importN, importN1] = await Promise.all([
    getBalance(undefined, veille(e.date_debut)),
    getBalance(undefined, e.date_fin),
    getBalance(e.date_debut, e.date_fin),
    getCompletude(e.date_debut, e.date_fin),
    getBalanceImportee(e.exercice_id),
    precedent ? getBalanceImportee(precedent.exercice_id) : Promise.resolve(null),
  ]);
  const donnees = assemblerDonnees({
    erp: {
      cumul,
      periode,
      ouverture,
      // Sans la RPC (migration non appliquée), on déduit la présence d'écritures des balances.
      ecrituresPeriode: completude?.ecritures_periode ?? (periode.length ? 1 : 0),
      ecrituresAvant: completude?.ecritures_avant ?? (ouverture.length ? 1 : 0),
    },
    importN,
    importN1,
  });
  const ef = calculerEtatsFinanciers(donnees.cumul, donnees.periode);
  const ouvertureEf = calculerEtatsFinanciers(donnees.ouverture, []);
  return {
    ...ef,
    tft: calculerTft(ouvertureEf, ef, donnees.periode),
    notes: calculerNotes(donnees.cumul, donnees.periode),
    donnees,
    ouvertureEf,
    completude: donnees.source === "erp" ? completude : null,
    balanceImportee: importN,
  };
}

// ─── Identification ──────────────────────────────────────────────────────────
export async function getIdentite(): Promise<Record<string, ValeurIdentite>> {
  const [liasse, fne] = await Promise.all([
    supabase.from("parametres_entreprise").select("cle, valeur").like("cle", "liasse.%"),
    // Paramètres FNE lisibles seulement avec fne.acceder_parametres : sinon, rien à reprendre.
    loadFNESettings().catch(() => ({}) as Record<string, string>),
  ]);
  if (liasse.error) throw liasse.error;
  const propres = Object.fromEntries((liasse.data ?? []).map((r) => [r.cle, r.valeur]));
  return resoudreIdentite(propres, fne);
}

/** Enregistre les champs saisis (administrateurs : RLS de parametres_entreprise). */
export async function enregistrerIdentite(valeurs: Record<string, string>) {
  const lignes = CHAMPS_IDENTITE.filter((c) => c.cle in valeurs).map((c) => ({
    cle: CLE_PARAMETRE(c.cle),
    valeur: valeurs[c.cle].trim() || null,
    categorie: CATEGORIE_PARAMETRES,
    description: `Liasse : ${c.libelle}`,
  }));
  if (!lignes.length) return;
  const { error } = await supabase
    .from("parametres_entreprise")
    .upsert(lignes, { onConflict: "cle" });
  if (error) throw error;
}
