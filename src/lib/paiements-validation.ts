import { attachClientIds } from "@/lib/facture-client-ids";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import type { Paiement } from "@/lib/paiements-api";
import { friendlyError } from "@/lib/friendly-error";

/**
 * Workflow de validation des paiements (Lot 2).
 *
 * Contrat serveur commun (réutilisable pour d'autres modules) :
 *  - `assert_permission('<module>.creer')` en garde d'entrée sur la création
 *  - `has_permission_v2(auth.uid(), '<module>.valider')` pour l'auto-validation
 *  - RPC `valider_<module>(id, commentaire?)`
 *  - RPC `rejeter_<module>(id, motif)` — motif obligatoire
 */

export function usePaiementsEnAttente(exerciceId?: string | null) {
  return useQuery({
    queryKey: ["paiements-en-attente", exerciceId],
    enabled: !!exerciceId,
    queryFn: async () => {
      const q = supabase
        .from("paiements")
        .select("*")
        .eq("statut", "en_attente_validation")
        .order("created_at", { ascending: false });
      if (exerciceId) q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return attachClientIds((data ?? []) as Paiement[]);
    },
    staleTime: 30_000,
  });
}

export function useValiderPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, commentaire }: { id: string; commentaire?: string }) => {
      const { data } = await callRpc("valider_paiement", {
        _paiement_id: id,
        _commentaire: commentaire ?? undefined,
      });
      return data as Paiement;
    },
    onSuccess: (p) => {
      toast.success(`Paiement ${p.reference} validé`);
      qc.invalidateQueries({ queryKey: ["paiements"] });
      qc.invalidateQueries({ queryKey: ["paiements-en-attente"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
}

export function useRejeterPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string }) => {
      const { data } = await callRpc("rejeter_paiement", {
        _paiement_id: id,
        _motif: motif,
      });
      return data as Paiement;
    },
    onSuccess: (p) => {
      toast.success(`Paiement ${p.reference} rejeté`);
      qc.invalidateQueries({ queryKey: ["paiements"] });
      qc.invalidateQueries({ queryKey: ["paiements-en-attente"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
}