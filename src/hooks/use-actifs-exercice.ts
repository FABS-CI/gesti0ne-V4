import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";

/**
 * Retourne l'ensemble des IDs (clients ou fournisseurs) « actifs » sur
 * l'exercice consulté : ceux qui ont un mouvement (facture/achat) OU un
 * report à-nouveau non nul sur cet exercice.
 */
export function useActifsExerciceIds(
  type: "client" | "fournisseur",
  enabled: boolean,
): { ids: Set<string> | null; isLoading: boolean } {
  const exerciceId = useExerciceConsulteId();
  const { data, isLoading } = useQuery({
    queryKey: ["actifs-exercice", type, exerciceId],
    enabled: enabled && !!exerciceId,
    queryFn: async () => {
      const ids = new Set<string>();
      if (!exerciceId) return ids;
      if (type === "client") {
        const results = await Promise.all([
          supabase.from("factures").select("client_id").eq("exercice_id", exerciceId),
          supabase.from("commandes").select("client_id").eq("exercice_id", exerciceId),
          supabase.from("bons_livraison").select("client_id").eq("exercice_id", exerciceId),
          supabase.from("retours").select("client_id").eq("exercice_id", exerciceId),
          supabase.from("bons_retour").select("client_id").eq("exercice_id", exerciceId),
          supabase.from("soldes_ouverture_clients").select("client_id").eq("exercice_id", exerciceId),
        ]);
        for (const { data: rows } of results) {
          for (const r of rows ?? []) if (r.client_id) ids.add(r.client_id);
        }
        // Les proformas n'ont pas de colonne exercice_id : filtre par dates de l'exercice.
        const { data: ex } = await supabase
          .from("exercices")
          .select("date_debut, date_fin")
            .eq("exercice_id", exerciceId)
          .maybeSingle();
        if (ex?.date_debut && ex?.date_fin) {
          const { data: pf } = await supabase
            .from("proformas")
            .select("client_id")
            .gte("date_proforma", ex.date_debut)
            .lte("date_proforma", ex.date_fin);
          for (const r of pf ?? []) if (r.client_id) ids.add(r.client_id);
        }
      } else {
        const [{ data: a }, { data: s }] = await Promise.all([
          supabase.from("achats").select("fournisseur_id").eq("exercice_id", exerciceId),
          supabase
            .from("soldes_ouverture_fournisseurs")
            .select("fournisseur_id")
            .eq("exercice_id", exerciceId),
        ]);
        for (const r of a ?? []) if (r.fournisseur_id) ids.add(r.fournisseur_id);
        for (const r of s ?? []) if (r.fournisseur_id) ids.add(r.fournisseur_id);
      }
      return ids;
    },
  });
  return { ids: enabled ? (data ?? null) : null, isLoading };
}
