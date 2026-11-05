import { friendlyError } from "@/lib/friendly-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  isProductionReady,
  loadFNESettings,
  submitFactureToFNE,
  type FNEStatus,
} from "@/lib/fne-api";

type Props = {
  facture: {
    facture_id: string;
    reference: string;
    client_nom: string | null;
    montant_total: number;
    date_facture: string;
  };
  fneStatut?: FNEStatus | null;
};

/**
 * Actions FNE par ligne — deux boutons distincts (Normaliser / Certifier),
 * structure prête pour l'intégration DGI. En sandbox ou tant que la
 * configuration FNE prod n'est pas complète, un tooltip explique l'état ;
 * les boutons restent visibles pour ne pas modifier l'interface plus tard.
 */
export function FneRowActions({ facture, fneStatut }: Props) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["fne-settings"],
    queryFn: loadFNESettings,
    staleTime: 60_000,
  });
  const prodReady = settings ? isProductionReady(settings) : false;

  const submit = useMutation({
    mutationFn: () =>
      submitFactureToFNE({
        facture_id: facture.facture_id,
        reference: facture.reference,
        client_nom: facture.client_nom,
        montant_total: facture.montant_total,
        date_facture: facture.date_facture,
      }),
    onSuccess: (d) => {
      toast.success(`FNE ${d.code_dgi ?? d.fne_id} — traitement enregistré`);
      qc.invalidateQueries({ queryKey: ["fne-by-factures"] });
      qc.invalidateQueries({ queryKey: ["fne-facture", facture.facture_id] });
      qc.invalidateQueries({ queryKey: ["fne-list"] });
      qc.invalidateQueries({ queryKey: ["fne-stats"] });
    },
    onError: (e: Error) => toast.error("Opération FNE refusée", { description: friendlyError(e) }),
  });

  const alreadySubmitted = fneStatut === "submitted" || fneStatut === "accepted";
  const busy = submit.isPending;

  const helperText = prodReady
    ? "Envoi réel à la DGI"
    : "Configuration FNE en attente — mode sandbox (aucune consommation de sticker)";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || alreadySubmitted}
                onClick={() => !busy && submit.mutate()}
              >
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Normaliser
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {alreadySubmitted
              ? "Facture déjà normalisée auprès du FNE"
              : `Normalisation FNE — ${helperText}`}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
