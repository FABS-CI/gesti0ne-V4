import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Search, Package, Ban, Trash2, RotateCcw, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { EmptyState } from "@/components/common/EmptyState";
import {
  listBonsLivraisonAColiser,
  STATUTS_BL,
  STATUT_BL_LABEL,
  annulerColisage,
  supprimerColisage,
  isColisageEnAttente,
  type BLAColiser,
} from "@/lib/colisage-api";
import { usePermissions } from "@/hooks/use-permissions";
import { Can } from "@/components/rbac/Can";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { invalidateColisage } from "@/lib/cache-invalidation";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/bons-livraison")({
  component: BonsLivraisonListPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function BonsLivraisonListPage() {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<string>("all");
  const exerciceId = useExerciceConsulteId();
  const hasActiveFilters = !!q || statut !== "all";
  const resetFilters = () => {
    setQ("");
    setStatut("all");
  };
  const { data, isLoading } = useQuery({
    queryKey: ["bons-livraison-list", exerciceId],
    enabled: !!exerciceId,
    queryFn: () => listBonsLivraisonAColiser(exerciceId),
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.statut === "colisage_supprime") return false;
      if (statut !== "all" && r.statut !== statut) return false;
      if (!ql) return true;
      return [r.reference, r.client_nom, r.etablissement, r.representant_nom, r.ville]
        .filter(Boolean)
        .some((x) => (x as string).toLowerCase().includes(ql));
    });
  }, [data, q, statut]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Bons de livraison"
        description="Consultation — les BL sont générés automatiquement à la validation d'une commande"
        actions={
          <Can permission="colisage.voir">
            <Button asChild variant="outline">
              <Link to="/colisage">
                <Package className="mr-2 h-4 w-4" /> Aller au colisage
              </Link>
            </Button>
          </Can>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (n°, client, établissement, ville…)"
              className="pl-8"
            />
          </div>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUTS_BL.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {q && (
            <Badge variant="secondary" className="gap-1">
              Recherche : {q}
              <button type="button" onClick={() => setQ("")} className="ml-1 rounded-full hover:bg-muted" aria-label="Retirer la recherche">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statut !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Statut : {STATUT_BL_LABEL[statut]?.label ?? statut}
              <button type="button" onClick={() => setStatut("all")} className="ml-1 rounded-full hover:bg-muted" aria-label="Retirer le statut">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 h-3 w-3" /> Réinitialiser
          </Button>
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6">
                      <EmptyState
                        variant={hasActiveFilters ? "compact" : "rich"}
                        icon={Truck}
                        title={
                          hasActiveFilters
                            ? "Aucun bon de livraison ne correspond aux filtres."
                            : "Aucun bon de livraison pour cet exercice."
                        }
                        description={
                          hasActiveFilters
                            ? undefined
                            : "Les BL apparaîtront ici dès qu'une commande sera préparée pour livraison."
                        }
                        onReset={hasActiveFilters ? resetFilters : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const st = STATUT_BL_LABEL[r.statut];
                    return (
                      <TableRow key={r.bl_id}>
                        <TableCell className="font-mono text-xs">{formatDocumentReference(r.reference)}</TableCell>
                        <TableCell>{frDate(r.date_emission)}</TableCell>
                        <TableCell>{r.client_nom ?? "—"}</TableCell>
                        <TableCell>{r.etablissement ?? "—"}</TableCell>
                        <TableCell>{r.ville ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.nb_articles}</TableCell>
                        <TableCell className="text-right">{r.total_quantite}</TableCell>
                        <TableCell>
                          {st ? (
                            <Badge style={{ backgroundColor: st.color }} className="text-white">
                              {st.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{r.statut}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions row={r} blId={r.bl_id} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </Card>
    </div>
  );
}

function RowActions({ row, blId }: { row: BLAColiser; blId: string }) {
  const qc = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const [openAnnul, setOpenAnnul] = useState(false);
  const [openSuppr, setOpenSuppr] = useState(false);
  const [motifAnnul, setMotifAnnul] = useState("");
  const [motifSuppr, setMotifSuppr] = useState("");

  const invalidate = () =>
    invalidateColisage(qc, {
      blId: row.bl_id,
      clientId: (row as { client_id?: string | null }).client_id ?? undefined,
    });

  const annulerMut = useMutation({
    mutationFn: (motif: string | null) => annulerColisage(row.bl_id, motif),
    onSuccess: () => {
      toast.success("Colisage annulé");
      setOpenAnnul(false);
      setMotifAnnul("");
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(friendlyError(e, "Erreur lors de l'annulation"));
      setOpenAnnul(false);
    },
  });
  const supprMut = useMutation({
    mutationFn: (motif: string | null) => supprimerColisage(row.bl_id, motif),
    onSuccess: (summary) => {
      const parts = summary
        ? [
            `${summary.colis_supprimes} colis`,
            summary.tournees_recalculees ? `${summary.tournees_recalculees} tournée(s) recalculée(s)` : null,
            summary.notifications_supprimees ? `${summary.notifications_supprimees} notif.` : null,
          ].filter(Boolean)
        : [];
      toast.success("Colisage supprimé", {
        description: parts.length ? parts.join(" · ") : undefined,
      });
      setOpenSuppr(false);
      setMotifSuppr("");
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(friendlyError(e, "Erreur lors de la suppression"));
      setOpenSuppr(false);
    },
  });

  const annulable = isColisageEnAttente(row.statut) || isSuperAdmin;
  const suppressible = isColisageEnAttente(row.statut) || row.statut === "annule" || isSuperAdmin;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const { generateUnifiedCommercialPDF } = await import("@/lib/pdf/unified-generator");
          const { loadBLDocLignes, loadClientInfoForBL } = await import("@/lib/pdf/enrich-lignes");
          const { fileNameFor } = await import("@/lib/pdf/fabsTemplates");

          const [lignes, clientInfo] = await Promise.all([
            loadBLDocLignes(blId),
            loadClientInfoForBL(blId),
          ]);

          const blob = await generateUnifiedCommercialPDF("Bon de Livraison", {
            id: blId,
            bl_id: blId,
            reference: row.reference,
            date: row.date_emission || new Date().toISOString(),
            clientNom: row.client_nom,
            lignes,
            ...clientInfo,
          });

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileNameFor(row.reference, row.client_nom || "Client");
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Printer className="mr-1 h-4 w-4" /> PDF
      </Button>
      {annulable && (
        <Can permission="colisage.annuler">
          <AlertDialog open={openAnnul} onOpenChange={setOpenAnnul}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Ban className="mr-1 h-4 w-4" /> Annuler
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler le colisage {formatDocumentReference(row.reference)} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action passe le BL au statut « Annulé » et supprime les cartons générés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Motif (optionnel)</Label>
                <Textarea value={motifAnnul} onChange={(e) => setMotifAnnul(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={annulerMut.isPending}
                  onClick={() => annulerMut.mutate(motifAnnul.trim() || null)}
                >
                  {annulerMut.isPending ? "Annulation…" : "Confirmer l'annulation"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Can>
      )}

      {suppressible && (
        <Can permission="colisage.supprimer">
          <AlertDialog open={openSuppr} onOpenChange={setOpenSuppr}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive">
                <Trash2 className="mr-1 h-4 w-4" />
                {isSuperAdmin ? "Supprimer définitivement" : "Supprimer"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isSuperAdmin
                    ? `Suppression définitive du BL ${formatDocumentReference(row.reference)}`
                    : `Supprimer le BL ${formatDocumentReference(row.reference)} ?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isSuperAdmin
                    ? "Action irréversible. L'opération sera tracée dans le journal d'audit."
                    : "Cette action supprime le colisage. Elle sera enregistrée dans le journal d'audit."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Motif {isSuperAdmin ? "(recommandé)" : "(optionnel)"}</Label>
                <Textarea value={motifSuppr} onChange={(e) => setMotifSuppr(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={supprMut.isPending}
                  onClick={() => supprMut.mutate(motifSuppr.trim() || null)}
                >
                  {supprMut.isPending ? "Suppression…" : "Confirmer la suppression"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Can>
      )}
    </div>
  );
}
