import { pgSafe } from "@/lib/postgrest-filter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Ecriture, JournalFiltersState } from "@/lib/comptabilite-helpers";

export function useComptabiliteEcritures(
  exerciceId: string | null | undefined,
  q: string,
  filters: JournalFiltersState,
) {
  const { dateFrom, dateTo, journal, lettrage } = filters;
  return useQuery({
    queryKey: ["comptabilite", exerciceId, q, dateFrom, dateTo, journal, lettrage],
    enabled: !!exerciceId,
    queryFn: async () => {
      let query = supabase
        .from("ecritures_comptables")
        .select(
          "ecriture_id, reference, date_ecriture, journal, libelle, source_type, lettrage, montant_total, ecriture_lignes(ligne_id, compte, compte_libelle, debit, credit)",
        );
      if (exerciceId) query = query.eq("exercice_id", exerciceId);
      if (q) query = query.or(`libelle.ilike.%${pgSafe(q)}%,reference.ilike.%${pgSafe(q)}%,lettrage.ilike.%${pgSafe(q)}%`);
      if (dateFrom) query = query.gte("date_ecriture", dateFrom);
      if (dateTo) query = query.lte("date_ecriture", dateTo);
      if (journal !== "all") query = query.eq("journal", journal);
      if (lettrage === "lettre") query = query.not("lettrage", "is", null);
      if (lettrage === "non") query = query.is("lettrage", null);
      query = query.order("date_ecriture", { ascending: false }).limit(500);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Ecriture[];
    },
  });
}
