import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, Eye, Send, PackageCheck, Ban } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  listTransferts,
  executerTransfert,
  receptionnerTransfert,
  annulerTransfert,
  type Transfert,
} from "@/lib/depots-api";
import { usePermissions } from "@/hooks/use-permissions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { EmptyState } from "@/components/common/EmptyState";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
export const Route = createFileRoute("/_authenticated/transferts/")({
  head: () => authRouteHead("Transferts"),
  component: TransfertsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const statutColors: Record<
  Transfert["statut"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  brouillon: "secondary",
  expedie: "default",
  recu: "default",
  annule: "destructive",
};

const statutLabels: Record<Transfert["statut"], string> = {
  brouillon: "Brouillon",
  expedie: "Expédié",
  recu: "Reçu",
  annule: "Annulé",
};

function TransfertsPage() {
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canExecuter = has("transferts.executer");
  const canReceptionner = has("transferts.receptionner");
  const canAnnuler = has("transferts.annuler");

  const [statut, setStatut] = useState<string>("all");
  const { data: transferts = [], isLoading } = useQuery({
    queryKey: ["transferts", statut],
    queryFn: () => listTransferts(statut === "all" ? undefined : { statut }),
  });

  const workflowMutation = useMutation({
    mutationFn: async (vars: { id: string; action: "executer" | "receptionner" | "annuler" }) => {
      if (vars.action === "executer") return executerTransfert(vars.id);
      if (vars.action === "receptionner") return receptionnerTransfert(vars.id);
      return annulerTransfert(vars.id);
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["transferts"] });
      toast.success(
        vars.action === "executer"
          ? "Transfert expédié, stock mis à jour"
          : vars.action === "receptionner"
            ? "Réception confirmée"
            : "Transfert annulé",
      );
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" /> Transferts inter-dépôts
          </h1>
          <p className="text-sm text-muted-foreground">Mouvements de stock entre dépôts</p>
        </div>
        <Button asChild>
          <Link to="/transferts/nouveau">
            <Plus className="mr-2 h-4 w-4" /> Nouveau transfert
          </Link>
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="expedie">Expédié</SelectItem>
            <SelectItem value="recu">Reçu</SelectItem>
            <SelectItem value="annule">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Vers</TableHead>
                <TableHead>Transporteur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : transferts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6">
                    <EmptyState
                      variant="rich"
                      icon={ArrowRightLeft}
                      title="Aucun transfert enregistré"
                      description="Déplacez du stock entre vos dépôts en créant un transfert : sortie automatique côté source, entrée à la réception."
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                transferts.map((t) => (
                  <TableRow key={t.transfert_id}>
                    <TableCell className="font-mono text-sm font-medium">{t.numero}</TableCell>
                    <TableCell>{format(new Date(t.date_creation), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{t.source?.nom ?? "—"}</TableCell>
                    <TableCell>{t.destination?.nom ?? "—"}</TableCell>
                    <TableCell>{t.transporteur ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statutColors[t.statut]}>{statutLabels[t.statut]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.statut === "brouillon" && canExecuter && (
                        <Button aria-label="Exécuter le transfert (sortie + entrée stock)"
                          variant="ghost"
                          size="icon"
                          title="Exécuter le transfert (sortie + entrée stock)"
                          onClick={() =>
                            workflowMutation.mutate({ id: t.transfert_id, action: "executer" })
                          }
                        >
                          <Send className="h-4 w-4 text-info" />
                        </Button>
                      )}
                      {t.statut === "brouillon" && canAnnuler && (
                        <Button aria-label="Annuler le transfert"
                          variant="ghost"
                          size="icon"
                          title="Annuler le transfert"
                          onClick={async () => {
                            const r = await confirm({
                              title: "Annuler ce transfert ?",
                              entityLabel: "le transfert",
                              entityName: t.numero,
                              confirmLabel: "Confirmer l'annulation",
                            });
                            if (r === false) return;
                            workflowMutation.mutate({ id: t.transfert_id, action: "annuler" });
                          }}
                        >
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {t.statut === "expedie" && canReceptionner && (
                        <Button aria-label="Réceptionner le transfert"
                          variant="ghost"
                          size="icon"
                          title="Réceptionner le transfert"
                          onClick={() =>
                            workflowMutation.mutate({ id: t.transfert_id, action: "receptionner" })
                          }
                        >
                          <PackageCheck className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          to="/transferts/$transfertId"
                          params={{ transfertId: t.transfert_id }}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>
      {confirmDialog}
    </div>
  );
}
