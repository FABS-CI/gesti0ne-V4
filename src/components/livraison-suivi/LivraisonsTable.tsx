import { COMMANDE_REF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Truck, Package } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/components/rbac/Can";
import { formatFCFA } from "@/lib/format";
import {
  nextEtape,
  workflowSteps,
  STATUT_COLOR,
  STATUT_LABEL,
  type LivSuiviCommande,
} from "@/lib/livraison-suivi-api";
import { deleteLivraisonSuivi } from "@/lib/livraison-suivi/writes";
import type { ColisInfo } from "@/lib/livraison-suivi/types";
import { friendlyError } from "@/lib/friendly-error";

type Props = {
  rows: Array<LivSuiviCommande & { colis?: ColisInfo | null }>;
  isLoading: boolean;
  onAdvance: (r: LivSuiviCommande & { colis?: ColisInfo | null }) => void;
};

export function LivraisonsTable({ rows, isLoading, onAdvance }: Props) {
  return (
    <div className="overflow-auto">
      <ResponsiveTable stickyFirstCol>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tournée</TableHead>
              <TableHead>Gare</TableHead>
              <TableHead>Livreur / Véhicule</TableHead>
              <TableHead>Colis / Cartons</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-64">Progression</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-6">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6">
                  <EmptyState
                    variant="rich"
                    icon={Truck}
                    title="Aucune livraison en cours"
                    description="Les commandes passant au statut « en livraison » s'afficheront ici pour suivre chaque étape jusqu'à la remise au client."
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const steps = workflowSteps(r.type_livraison);
                const idx = steps.indexOf(r.statut);
                const pct = ((idx + 1) / steps.length) * 100;
                const next = nextEtape(r.type_livraison, r.statut);
                const colis = r.colis ?? null;
                const gare =
                  r.gare_destination ?? colis?.gare_depart ?? null;
                const ville =
                  r.ville_destination ??
                  colis?.ville_destination ??
                  colis?.ville_livraison ??
                  null;
                const livreur =
                  r.livreur_nom ??
                  r.tournee?.livreur_nom ??
                  colis?.livreur_nom ??
                  colis?.transporteur ??
                  null;
                const vehicule =
                  r.vehicule ?? r.tournee?.vehicule ?? colis?.vehicule ?? null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* On tente de récupérer le 1er produit pour l'image (si dispo dans l'objet enrichi) */}
                        <ProductCoverThumb 
                          produit={null} 
                          size="xs" 
                        />
                        <div className="min-w-0">
                          <Link
                            to="/livraison-suivi/$commandeRef"
                            search={COMMANDE_REF_SEARCH_DEFAULTS}
                            params={{ commandeRef: r.commande?.reference ?? "" }}
                            className="font-mono text-xs font-medium hover:underline"
                          >
                            {r.commande?.reference ?? "—"}
                          </Link>
                          {r.commande?.montant_total != null && (
                            <div className="text-xs text-muted-foreground">
                              {formatFCFA(r.commande.montant_total)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.commande?.client_nom ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.commande?.ville ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.type_livraison === "direct" ? "default" : "secondary"}>
                        {r.type_livraison === "direct" ? "Direct" : "Expédition"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.tournee?.reference ? (
                        <Link
                          to="/tournees/$tourneeId"
                          params={{ tourneeId: r.tournee.tournee_id }}
                          className="font-mono hover:underline"
                        >
                          {r.tournee.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {r.ordre_passage != null && (
                        <div className="text-xs text-muted-foreground">#{r.ordre_passage}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {[gare, ville].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{livreur ?? "—"}</div>
                      {vehicule && (
                        <div className="text-xs text-muted-foreground">{vehicule}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>1 colis</div>
                      {r.nb_cartons != null && (
                        <div className="text-xs text-muted-foreground">
                          {r.nb_cartons} carton{r.nb_cartons > 1 ? "s" : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge style={{ backgroundColor: STATUT_COLOR[r.statut], color: "white" }}>
                        {STATUT_LABEL[r.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Progress value={pct} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {idx + 1} / {steps.length}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {next ? (
                          <Can
                            permission="livraisons.changer_statut"
                            fallback={<Badge variant="outline">Lecture seule</Badge>}
                          >
                            <Button size="sm" onClick={() => onAdvance(r)}>
                              → {STATUT_LABEL[next]}
                            </Button>
                          </Can>
                        ) : (
                          <Badge variant="outline">Terminé</Badge>
                        )}
                        <Can permission="livraisons.changer_statut">
                          <DeleteLivraisonButton id={r.id} reference={r.commande?.reference ?? ""} />
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </div>
  );
}

function DeleteLivraisonButton({ id, reference }: { id: string; reference: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: (motif: string | null) => deleteLivraisonSuivi(id, motif),
    onSuccess: (summary) => {
      const parts = summary
        ? [
            summary.historique_supprime
              ? `${summary.historique_supprime} évènement(s) historique`
              : null,
            summary.colis_reinitialises
              ? `${summary.colis_reinitialises} colis remis à « prêt »`
              : null,
            (summary.livraisons_detachees ?? 0) +
            (summary.livraisons_commande_detachees ?? 0)
              ? `${(summary.livraisons_detachees ?? 0) + (summary.livraisons_commande_detachees ?? 0)} livraison(s) détachée(s)`
              : null,
            summary.notifications_supprimees
              ? `${summary.notifications_supprimees} notif.`
              : null,
          ].filter(Boolean)
        : [];
      toast.success("Suivi de livraison supprimé", {
        description: parts.length ? parts.join(" · ") : undefined,
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["livsuivi"] });
      qc.invalidateQueries({ queryKey: ["livraisons"] });
      qc.invalidateQueries({ queryKey: ["livraisons-commande"] });
      qc.invalidateQueries({ queryKey: ["colis-for-bl"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e, "Erreur lors de la suppression")),
  });
  return (
    <>
      <Button aria-label="Supprimer ce suivi"
        size="icon"
        variant="ghost"
        className="text-destructive"
        title="Supprimer ce suivi"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        entityLabel="ce suivi de livraison"
        entityName={reference || null}
        description="Le suivi et son historique seront supprimés. Les colis liés seront remis à l'état « prêt » et les livraisons rattachées seront détachées."
        consequences={[
          "Historique du suivi supprimé",
          "Colis remis à l'état « prêt » (dates de remise/départ/arrivée effacées)",
          "Livraisons et livraisons de commande détachées",
          "Notifications liées supprimées",
        ]}
        motifRequired
        pending={mut.isPending}
        onConfirm={(motif) => mut.mutate(motif)}
      />
    </>
  );
}
