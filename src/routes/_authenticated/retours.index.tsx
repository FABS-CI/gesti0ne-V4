import { PageHeader } from "@/components/common/PageHeader";
import { ClientLink } from "@/components/common/ClientLink";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Plus, Search, Eye, XCircle, Download, FileDown, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportPdf } from "@/lib/export-csv";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/common/EmptyState";

import {
  listRetours,
  annulerRetour,
  supprimerRetour,
  STATUTS_RETOUR,
  STATUT_RETOUR_LABEL,
  type Retour,
} from "@/lib/retours-api";
import { describeSupabaseError } from "@/lib/rbac-api";
import { Can } from "@/components/rbac/Can";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { useUserRoles } from "@/hooks/use-user-roles";
import { generateBonRetourPDF } from "@/lib/pdf/fabsTemplates";
import { buildRetourDocBase } from "@/lib/pdf/retour-builder";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";


import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/retours/")({
  head: () => authRouteHead("Retours"),
  component: RetoursListPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function RetoursListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("all");
  const [page, setPage] = useState(1);
  const [toCancel, setToCancel] = useState<Retour | null>(null);
  const [toDelete, setToDelete] = useState<Retour | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const { isSuperAdmin } = useUserRoles();
  const pageSize = 20;
  const exerciceId = useExerciceConsulteId();
  const hasActiveFilters = !!q || statut !== "all";
  const resetFilters = () => {
    setQ("");
    setStatut("all");
    setPage(1);
  };

  const { data: retours = [], isLoading } = useQuery({
    queryKey: ["retours", exerciceId, { q, statut }],
    enabled: !!exerciceId,
    queryFn: () => listRetours({ q, statut, exerciceId }),
  });

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return retours.slice(start, start + pageSize);
  }, [retours, page]);

  const totalPages = Math.max(1, Math.ceil(retours.length / pageSize));

  const cancelMutation = useMutation({
    mutationFn: (id: string) => annulerRetour(id),
    onSuccess: () => {
      toast.success("Retour annulé");
      qc.invalidateQueries({ queryKey: ["retours"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setToCancel(null);
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supprimerRetour(id),
    onSuccess: () => {
      toast.success("Retour supprimé définitivement");
      qc.invalidateQueries({ queryKey: ["retours"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setToDelete(null);
      setConfirmText("");
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const downloadPdf = async (r: Retour) => {
    try {
      const data = await buildRetourDocBase(r.retour_id);
      const blob = await generateBonRetourPDF(data);
      downloadBlob(blob, `bon-retour-${r.numero ?? r.reference}.pdf`);
    } catch (e) {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    }
  };


  const onExport = () => {
    const headers = [
      "Numéro",
      "Date",
      "Client",
      "Représentant",
      "Ville",
      "Produits",
      "Quantité",
      "Statut",
      "Enregistré par",
    ];
    const rows = retours.map((r) => [
      r.numero ?? r.reference,
      r.date_retour,
      r.etablissement ?? r.client_nom ?? "",
      r.representant_nom ?? "",
      r.ville ?? "",
      String(r.nb_produits),
      String(r.total_quantite),
      STATUT_RETOUR_LABEL[r.statut]?.label ?? r.statut,
      r.created_by_nom ?? "",
    ]);
    exportPdf(`retours-${new Date().toISOString().slice(0, 10)}`, headers, rows, {
      pageTitle: "Liste des retours",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        className="mb-0"
        title="Retours"
        description="Gestion des retours produits"
        actions={
          <>
            <Button variant="outline" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Exporter PDF
            </Button>
            <Can permission="retours.creer">
              <Button onClick={() => navigate({ to: "/retours/nouveau", search: { clientId: undefined, type_retour: "physique" } as any })}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau retour
              </Button>
            </Can>
          </>
        }
      />

      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher numéro, client, représentant, ville…"
              className="pl-9"
            />
          </div>
          <Select
            value={statut}
            onValueChange={(v) => {
              setStatut(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUTS_RETOUR.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {q && (
              <Badge variant="secondary" className="gap-1">
                Recherche : {q}
                <button type="button" onClick={() => { setQ(""); setPage(1); }} className="ml-1 rounded-full hover:bg-muted" aria-label="Retirer la recherche">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {statut !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Statut : {STATUT_RETOUR_LABEL[statut]?.label ?? statut}
                <button type="button" onClick={() => { setStatut("all"); setPage(1); }} className="ml-1 rounded-full hover:bg-muted" aria-label="Retirer le statut">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-1 h-3 w-3" /> Réinitialiser
            </Button>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : retours.length === 0 ? (
          <EmptyState
            variant={hasActiveFilters ? "compact" : "rich"}
            icon={RotateCcw}
            title={
              hasActiveFilters
                ? "Aucun retour ne correspond aux filtres appliqués."
                : "Aucun retour enregistré pour cet exercice."
            }
            description={
              hasActiveFilters
                ? undefined
                : "Enregistrez un retour pour créditer le client, réintégrer le stock ou déclencher un avoir."
            }
            onReset={hasActiveFilters ? resetFilters : undefined}
            action={
              !hasActiveFilters ? (
                <Can permission="retours.creer">
                  <Button size="sm" onClick={() => navigate({ to: "/retours/nouveau", search: { clientId: undefined, type_retour: "physique" } as any })}>
                    <Plus className="mr-2 h-4 w-4" /> Nouveau retour
                  </Button>
                </Can>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <ResponsiveTable stickyFirstCol>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[8%] font-bold">N°</TableHead>
                      <TableHead className="w-[10%] font-bold">Date</TableHead>
                      <TableHead className="w-[25%] font-bold">Client (Établissement)</TableHead>
                      <TableHead className="w-[15%] font-bold">Représentant</TableHead>
                      <TableHead className="w-[10%] font-bold">Ville</TableHead>
                      <TableHead className="w-[7%] text-right font-bold">Qté</TableHead>
                      <TableHead className="w-[15%] font-bold text-center">Statut</TableHead>
                      <TableHead className="w-[10%] text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => {
                      const st = STATUT_RETOUR_LABEL[r.statut];
                      return (
                    <TableRow key={r.retour_id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono font-medium text-[10px] md:text-xs whitespace-nowrap">
                        {r.numero || r.reference}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.date_retour).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm leading-tight break-words max-w-[200px]">
                          <ClientLink clientId={r.client_id} nom={r.etablissement || r.client_nom} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]" title={r.representant_nom || ""}>
                        {r.representant_nom || "—"}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[100px]">{r.ville || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{r.total_quantite || 0}</TableCell>
                      <TableCell className="text-center">
                        {st && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0 h-5 whitespace-nowrap inline-flex text-white border-none"
                            style={{ backgroundColor: st.color }}
                          >
                            {st.label}
                          </Badge>
                        )}
                      </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button aria-label="Consulter" asChild variant="ghost" size="icon" title="Consulter">
                                <Link to="/retours/$retourId" params={{ retourId: r.retour_id }}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                aria-label="Télécharger le bon de retour"
                                variant="ghost"
                                size="icon"
                                title="Télécharger le bon de retour (PDF)"
                                onClick={() => downloadPdf(r)}
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                              {r.statut !== "annule" && (
                                <Can permission="retours.annuler">
                                  <Button aria-label="Annuler"
                                    variant="ghost"
                                    size="icon"
                                    title="Annuler"
                                    onClick={() => setToCancel(r)}
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                </Can>
                              )}
                              {isSuperAdmin && (
                                <Button
                                  aria-label="Supprimer définitivement"
                                  variant="ghost"
                                  size="icon"
                                  title="Supprimer définitivement (Super Admin)"
                                  onClick={() => {
                                    setToDelete(r);
                                    setConfirmText("");
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-700" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {retours.length} retour{retours.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Précédent
                </Button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le stock réintégré sera ressorti. Cette action est tracée dans le journal d'audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && cancelMutation.mutate(toCancel.retour_id)}
            >
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) {
            setToDelete(null);
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              Supprimer définitivement ce retour ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="font-medium text-red-600">
                  ! Action irréversible réservée aux Super Administrateurs.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Si le retour est actif, ses effets seront d'abord inversés (stock ressorti, facture / solde client rétablis).</li>
                  <li>Le retour et toutes ses lignes seront ensuite effacés.</li>
                  <li>Aucune restauration possible depuis l'interface.</li>
                  <li>L'opération est tracée dans le journal d'audit.</li>
                </ul>
                <div className="pt-1">
                  <p className="mb-1">
                    Tapez <span className="font-mono font-semibold">SUPPRIMER</span> pour confirmer :
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SUPPRIMER"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "SUPPRIMER" || deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.retour_id)}
              className="bg-red-700 hover:bg-red-800"
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
