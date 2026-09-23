import { supabase } from "@/integrations/supabase/client";

export type FraisTransportFilters = {
  dateDu?: string | null;
  dateAu?: string | null;
  type?: "livraison" | "expedition" | null;
  clientId?: string | null;
  statut?: string | null;
  exerciceId?: string | null;
  granularite?: "jour" | "semaine" | "mois" | "annee";
};

export type FraisTransportRapport = {
  kpi: {
    total: number;
    livraison: number;
    expedition: number;
    nb_factures: number;
    nb_commandes: number;
    moyenne: number;
  };
  periodes: { periode: string; livraison: number; expedition: number; total: number }[];
  clients: { client_id: string | null; client_nom: string; total: number; nb: number }[];
  lignes: {
    facture_id: string | null;
    reference: string | null;
    date_facture: string | null;
    client_nom: string | null;
    type_frais_transport: string | null;
    montant_frais_transport: number;
    statut: string | null;
  }[];
};

const EMPTY: FraisTransportRapport = {
  kpi: { total: 0, livraison: 0, expedition: 0, nb_factures: 0, nb_commandes: 0, moyenne: 0 },
  periodes: [],
  clients: [],
  lignes: [],
};

/** Rapport des frais de transport : source unique = RPC `rapport_frais_transport`. */
export async function getRapportFraisTransport(
  f: FraisTransportFilters,
): Promise<FraisTransportRapport> {
  const { data, error } = await supabase.rpc("rapport_frais_transport", {
    _date_du: f.dateDu ?? null,
    _date_au: f.dateAu ?? null,
    _type: f.type ?? null,
    _client_id: f.clientId ?? null,
    _statut: f.statut ?? null,
    _exercice_id: f.exerciceId ?? null,
    _granularite: f.granularite ?? "mois",
  } as never);
  if (error) throw error;
  const r = (data ?? {}) as Partial<FraisTransportRapport>;
  return {
    kpi: { ...EMPTY.kpi, ...(r.kpi ?? {}) },
    periodes: r.periodes ?? [],
    clients: r.clients ?? [],
    lignes: r.lignes ?? [],
  };
}
