import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import { Can } from "@/components/rbac/Can";
import { toast } from "sonner";

import {
  listConges,
  updateConge,
  deleteConge,
  STATUTS_CONGE,
  STATUT_CONGE_LABEL,
  TYPE_CONGE_LABEL,
} from "@/lib/rh-api";

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
import { friendlyError } from '@/lib/friendly-error';
export const Route = createFileRoute("/_authenticated/conges/")({
  head: () => authRouteHead("Congés"),
  component: CongesListPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function CongesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const [statutFilter, setStatutFilter] = useState("all");

  const { data: conges = [], isLoading } = useQuery({
    queryKey: ["conges", statutFilter],
    queryFn: () => listConges(statutFilter === "all" ? undefined : statutFilter),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) => updateConge(id, { statut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conges"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conges"] });
      toast.success("Demande supprimée");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Congés
          </h1>
          <p className="text-sm text-muted-foreground">Demandes et validations de congés</p>
        </div>
        <div className="flex gap-2">
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUTS_CONGE.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate({ to: "/conges/nouveau" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle demande
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Motif</TableHead>
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
            ) : conges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6">
                  <EmptyState
                    variant="rich"
                    icon={CalendarDays}
                    title="Aucune demande de congé"
                    description="Les demandes soumises par vos employés apparaîtront ici, prêtes à être approuvées ou refusées."
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              conges.map((c) => {
                const statutMeta = STATUT_CONGE_LABEL[c.statut];
                return (
                  <TableRow key={c.conge_id}>
                    <TableCell className="font-medium">{c.employes?.nom_complet ?? "—"}</TableCell>
                    <TableCell>{TYPE_CONGE_LABEL[c.type] ?? c.type}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(c.date_debut)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(c.date_fin)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.motif ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          color: statutMeta?.color,
                          borderColor: statutMeta?.color,
                        }}
                      >
                        {statutMeta?.label ?? c.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.statut === "en_attente" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Approuver"
                            onClick={() =>
                              statusMutation.mutate({
                                id: c.conge_id,
                                statut: "approuve",
                              })
                            }
                          >
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Refuser"
                            onClick={() =>
                              statusMutation.mutate({
                                id: c.conge_id,
                                statut: "refuse",
                              })
                            }
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Modifier"
                        onClick={() =>
                          navigate({
                            to: "/conges/$congeId/modifier",
                            params: { congeId: c.conge_id },
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Can permission="conges.supprimer">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer"
                          onClick={async () => {
                            const r = await confirm({
                              title: "Supprimer cette demande ?",
                              entityLabel: "la demande de congé",
                            });
                            if (r === false) return;
                            deleteMutation.mutate(c.conge_id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {confirmDialog}
    </div>
  );
}
