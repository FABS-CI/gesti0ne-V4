import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centre de pilotage : agrégat 100 % serveur (RPC `cockpit_overview`).
 * Chaque bloc n'est présent que si l'utilisateur possède la permission
 * correspondante côté serveur — un bloc absent = non autorisé.
 */
export type CockpitFacture = {
  id: string;
  reference: string;
  client_id: string | null;
  client_nom: string | null;
  reste: number;
  jours: number;
};
export type CockpitDebiteur = { client_id: string; client_nom: string | null; reste: number };
export type CockpitBL = {
  id: string;
  reference: string;
  client_id: string | null;
  client_nom: string | null;
  date_bon: string | null;
};
export type CockpitLivraison = {
  id: string;
  reference: string | null;
  client_nom: string | null;
  date_livraison: string | null;
  bl_id: string | null;
};
export type CockpitProduit = {
  id: string;
  titre: string;
  reference: string | null;
  stock: number;
  seuil: number;
};
export type CockpitRetour = {
  id: string;
  reference: string | null;
  client_id: string | null;
  client_nom: string | null;
  date_retour: string | null;
};
type Bloc<T> = { count: number; items: T[] };

export type CockpitData = {
  generatedAt: string;
  today: string;
  impayes30?: Bloc<CockpitFacture> & { montant: number };
  anciennete?: { b0_30: number; b31_60: number; b61_90: number; b90p: number; total: number };
  debiteurs?: Bloc<CockpitDebiteur>;
  aPreparer?: Bloc<CockpitBL>;
  livraisonsRetard?: Bloc<CockpitLivraison>;
  paiementsJour?: { count: number; montant: number };
  stockBas?: Bloc<CockpitProduit>;
  retoursAttente?: Bloc<CockpitRetour>;
  direction?: {
    commandes30: number;
    facture30: number | null;
    encaisse30: number | null;
    resteTotal: number | null;
    topClients: { client_id: string; client_nom: string | null; montant: number }[] | null;
  };
};

export const cockpitQueryOptions = (exerciceId: string | null) =>
  queryOptions({
    queryKey: ["cockpit-overview", exerciceId],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<CockpitData> => {
      const { data, error } = await supabase.rpc("cockpit_overview", {
        _exercice_id: exerciceId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as unknown as CockpitData;
    },
  });
