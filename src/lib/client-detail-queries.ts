import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client, ClientRelations } from "@/lib/clients-api";

const SLICE_STALE = 30_000;

export const clientQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("client_id", clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
    staleTime: SLICE_STALE,
  });

export const clientCommandesQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "commandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes")
        .select("commande_id,reference,statut,date_commande,montant_total")
        .eq("client_id", clientId)
        .order("date_commande", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRelations["commandes"];
    },
    staleTime: SLICE_STALE,
  });

export const clientFacturesQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "factures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("facture_id,reference,statut,date_facture,montant_total,montant_paye")
        .eq("client_id", clientId)
        .order("date_facture", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRelations["factures"];
    },
    staleTime: SLICE_STALE,
  });

export const clientProformasQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "proformas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proformas")
        .select("proforma_id,reference,statut,date_proforma,date_validite,montant_total")
        .eq("client_id", clientId)
        .order("date_proforma", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRelations["proformas"];
    },
    staleTime: SLICE_STALE,
  });

export const clientBLQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "bl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bons_livraison")
        .select("bl_id,reference,statut,date_emission,date_livraison,montant,commande_id")
        .eq("client_id", clientId)
        .order("date_emission", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map(({ montant, ...b }) => ({
        ...b,
        montant_total: Number(montant ?? 0),
      })) as ClientRelations["bons_livraison"];
    },
    staleTime: SLICE_STALE,
  });

export const clientAvoirsQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "avoirs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retours")
        .select("retour_id,reference,statut,date_retour,montant,motif")
        .eq("client_id", clientId)
        .order("date_retour", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRelations["avoirs"];
    },
    staleTime: SLICE_STALE,
  });

export const clientPaiementsQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "paiements"],
    queryFn: async () => {
      const { data: facs, error: fErr } = await supabase
        .from("factures")
        .select("facture_id")
        .eq("client_id", clientId);
      if (fErr) throw fErr;
      const ids = (facs ?? []).map((f) => f.facture_id);
      if (ids.length === 0) return [] as ClientRelations["paiements"];
      const { data, error } = await supabase
        .from("paiements")
        .select("paiement_id,reference,mode_paiement,statut,date_paiement,montant")
        .in("facture_id", ids)
        .order("date_paiement", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRelations["paiements"];
    },
    staleTime: SLICE_STALE,
  });

export const clientLivraisonsQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "livraisons"],
    queryFn: async () => {
      const { data: bls, error: bErr } = await supabase
        .from("bons_livraison")
        .select("bl_id")
        .eq("client_id", clientId);
      if (bErr) throw bErr;
      const ids = (bls ?? []).map((b) => b.bl_id);
      if (ids.length === 0) return [] as ClientRelations["livraisons"];
      const { data, error } = await supabase
        .from("livraisons")
        .select("livraison_id,reference,statut,date_livraison")
        .in("bl_id", ids)
        .order("date_livraison", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((l) => ({
        livraison_id: l.livraison_id,
        reference: l.reference,
        statut: l.statut,
        date_livraison: l.date_livraison,
        transporteur: null,
      })) as ClientRelations["livraisons"];
    },
    staleTime: SLICE_STALE,
  });

async function headCount(table: string, clientId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);
  if (error) throw error;
  return count ?? 0;
}

export const clientCountsQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "counts"],
    queryFn: async () => {
      const [commandes, proformas, bl, avoirs, factures, factureRows, blRows] = await Promise.all([
        headCount("commandes", clientId),
        headCount("proformas", clientId),
        headCount("bons_livraison", clientId),
        headCount("retours", clientId),
        headCount("factures", clientId),
        supabase.from("factures").select("facture_id").eq("client_id", clientId),
        supabase.from("bons_livraison").select("bl_id").eq("client_id", clientId),
      ]);
      const factureIds = (factureRows.data ?? []).map((f) => f.facture_id);
      const blIds = (blRows.data ?? []).map((b) => b.bl_id);

      const [paiementsRes, livraisonsRes] = await Promise.all([
        factureIds.length
          ? supabase
              .from("paiements")
              .select("*", { count: "exact", head: true })
              .in("facture_id", factureIds)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        blIds.length
          ? supabase
              .from("livraisons")
              .select("*", { count: "exact", head: true })
              .in("bl_id", blIds)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ]);

      return {
        commandes,
        proformas,
        bl,
        avoirs,
        factures,
        paiements: paiementsRes.count ?? 0,
        livraisons: livraisonsRes.count ?? 0,
      };
    },
    staleTime: SLICE_STALE,
  });

