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
    ville: string | null;
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
  // Le RPC renvoie les clés : facture, date_iso, client, type, transport, ville.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (data ?? {}) as any;
  const lignes: FraisTransportRapport["lignes"] = (r.lignes ?? []).map((l: any) => ({
    facture_id: l.facture_id ?? null,
    reference: l.facture ?? l.reference ?? null,
    date_facture: l.date_iso ?? l.date_facture ?? null,
    client_nom: l.client ?? l.client_nom ?? null,
    type_frais_transport: l.type ?? l.type_frais_transport ?? null,
    montant_frais_transport: Number(l.transport ?? l.montant_frais_transport ?? 0),
    statut: l.statut ?? null,
    ville: l.ville ?? null,
  }));
  const clients = (r.clients ?? []).map((c: any) => ({
    client_id: c.client_id ?? null,
    client_nom: c.client ?? c.client_nom ?? NON_RENSEIGNE,
    total: Number(c.total ?? 0),
    nb: Number(c.nb ?? 0),
  }));
  return {
    kpi: { ...EMPTY.kpi, ...(r.kpi ?? {}) },
    periodes: r.periodes ?? [],
    clients,
    lignes,
  };
}

export const NON_RENSEIGNE = "Non renseigné";

/** Totaux recalculés depuis les lignes affichées (Total = somme des lignes). */
export function totauxDepuisLignes(lignes: FraisTransportRapport["lignes"]) {
  let total = 0, livraison = 0, expedition = 0;
  for (const l of lignes) {
    total += l.montant_frais_transport;
    if (l.type_frais_transport === "livraison") livraison += l.montant_frais_transport;
    else if (l.type_frais_transport === "expedition") expedition += l.montant_frais_transport;
  }
  return { total, livraison, expedition, nb: lignes.length };
}
