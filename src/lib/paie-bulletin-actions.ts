import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";
import { generateBulletinPaieCIPDF, bulletinFileName, ENTREPRISE_FABS } from "@/lib/pdf/bulletinPaieCI";
import {
  construireDonneesPdf,
  calculerCumuls,
  type BulletinCumul,
  type BulletinStocke,
  type LigneStockee,
} from "@/lib/paie/bulletin-pdf-data";

/** CMU : forfait mensuel fixe (salarié et employeur). */
export const CMU_FORFAIT_FCFA = 1000;

/** Statuts pouvant encore être validés. */
export const STATUTS_VALIDABLES = ["brouillon", "genere"] as const;
export const estValidable = (statut: unknown) =>
  (STATUTS_VALIDABLES as readonly string[]).includes(String(statut));

/** Validation directe, droits vérifiés côté serveur. */
export async function validerBulletin(bulletinId: string) {
  const { error } = await supabase.rpc("paie_valider_bulletin", { p_bulletin_id: bulletinId });
  if (error) throw error;
}

/** Construit les données PDF uniquement depuis les lignes enregistrées (aucun recalcul). */
export async function buildBulletinRowPdf(bulletinId: string) {
  const { data: b, error } = await supabase
    .from("bulletins_paie")
    .select("*")
    .eq("bulletin_id", bulletinId)
    .single();
  if (error) throw error;
  const { data: lignes, error: e2 } = await supabase
    .from("bulletin_lignes")
    .select("numero_rubrique,designation,libelle,nombre,base,taux,gain,retenue,bloc,ordre")
    .eq("bulletin_id", bulletinId)
    .order("ordre");
  if (e2) throw e2;
  if (!lignes?.length) throw new Error("Ce bulletin ancien n'a pas de lignes détaillées : PDF indisponible.");
  const bb = b as unknown as BulletinStocke & { employe_id?: string | null; date_fin?: string | null };
  let employe = null;
  let cumuls;
  if (bb.employe_id) {
    const { data } = await supabase
      .from("employes")
      .select("matricule,poste,categorie,numero_cnps,date_embauche,departement,adresse")
      .eq("employe_id", bb.employe_id)
      .maybeSingle();
    employe = data;
    if (bb.date_fin) {
      const { data: hist } = await supabase
        .from("bulletins_paie")
        .select("brut_imposable,jours_travailles,bulletin_lignes(numero_rubrique,retenue)")
        .eq("employe_id", bb.employe_id)
        .gte("date_fin", `${bb.date_fin.slice(0, 4)}-01-01`)
        .lte("date_fin", bb.date_fin);
      cumuls = calculerCumuls(
        (hist ?? []).map((h) => ({
          brut_imposable: h.brut_imposable,
          jours_travailles: h.jours_travailles,
          lignes: (h.bulletin_lignes ?? []) as BulletinCumul["lignes"],
        })),
      );
    }
  }
  const data = construireDonneesPdf(bb, lignes as LigneStockee[], employe, ENTREPRISE_FABS, cumuls);
  return { data, employeNom: bb.employe_nom };
}

export async function telechargerBulletin(bulletinId: string) {
  const { data, employeNom } = await buildBulletinRowPdf(bulletinId);
  const blob = await generateBulletinPaieCIPDF(data);
  downloadBlob(blob, bulletinFileName(data.reference, employeNom));
}
