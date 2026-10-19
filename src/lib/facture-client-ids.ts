import { supabase } from "@/integrations/supabase/client";

/** Lecture groupée uniquement : aucun rapprochement par nom. */
export async function attachClientIds<T extends { facture_id?: string | null; client_id?: string | null }>(rows: readonly T[]): Promise<Array<T & { client_id: string | null }>> {
  const ids = [...new Set(rows.map((r) => r.facture_id).filter((id): id is string => Boolean(id)))];
  const clients = new Map<string, string | null>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from("factures").select("facture_id, client_id")
      .in("facture_id", ids.slice(offset, offset + 200));
    if (error) throw error;
    for (const f of data ?? []) clients.set(f.facture_id, f.client_id);
  }
  return rows.map((r) => ({ ...r, client_id: r.client_id ?? (r.facture_id ? clients.get(r.facture_id) : null) ?? null }));
}