import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Search, Plus, Download, FileDown, Ban, Trash2, RotateCcw, X } from "lucide-react";
import { generateRecuPaiementPDF, downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { toast } from "sonner";

import {
  listPaiements,
  MODE_PAIEMENT_LABEL,
  STATUTS_PAIEMENT,
  STATUT_PAIEMENT_LABEL,
  getRecuContext,
  supprimerPaiementDefinitif,
} from "@/lib/paiements-api";
import { describeSupabaseError } from "@/lib/rbac-api";

import { formatFCFA, formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { useUserRoles } from "@/hooks/use-user-roles";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PaiementsEnAttenteCard } from "@/components/paiements/PaiementsEnAttenteCard";
import { EmptyState } from "@/components/common/EmptyState";
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

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
export const Route = createFileRoute("/_authenticated/paiements/")({
  head: () => authRouteHead("Paiements"),
  component: PaiementsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function PaiementsPage() {
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const q = useDebouncedValue(search, 300);
  const exerciceId = useExerciceConsulteId();
  const { isSuperAdmin, hasRole } = useUserRoles();
  const canHardDelete = isSuperAdmin || hasRole("directeur_general");
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ref: string } | null>(null);
  const [deleteMotif, setDeleteMotif] = useState("");
  const deleteMutation = useMutation({
    mutationFn: () => supprimerPaiementDefinitif(deleteTarget!.id, deleteMotif.trim()),
    onSuccess: () => {
      toast.success("Paiement supprimé définitivement");
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      setDeleteTarget(null);
      setDeleteMotif("");
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ["paiements", exerciceId, q, statutFilter],
    enabled: !!exerciceId,
    queryFn: () => listPaiements(q, statutFilter === "all" ? undefined : statutFilter, exerciceId),
  });

  const hasActiveFilters = !!q || statutFilter !== "all";
  function resetAllFilters() {
    setSearch("");
    setStatutFilter("all");
  }

  const total = useMemo(
    () => paiements.filter((p) => p.statut === "valide").reduce((s, p) => s + Number(p.montant), 0),
    [paiements],
  );

  function handleExport() {
    exportCsv(
      "paiements.csv",
      ["Référence", "Date", "Client", "Montant", "Mode", "Statut"],
      paiements.map((p) => [
        p.reference,
        p.date_paiement,
        p.client_nom ?? "",
        String(p.montant),
        MODE_PAIEMENT_LABEL[p.mode_paiement] ?? p.mode_paiement,
        STATUT_PAIEMENT_LABEL[p.statut]?.label ?? p.statut,
      ]),
      {
        pageTitle: "RELEVÉ DES PAIEMENTS",
        summary: [
          { label: "Nombre de règlements", value: String(paiements.length) },
          {
            label: "Règlements validés",
            value: String(paiements.filter((p) => p.statut === "valide").length),
          },
          { label: "Total encaissé (validé)", value: formatFCFA(total) },
          {
            label: "Clients distincts",
            value: String(new Set(paiements.map((p) => p.client_nom).filter(Boolean)).size),
          },
        ],
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Paiements
          </h1>
          <p className="text-sm text-muted-foreground">Encaissements et règlements clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!paiements.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button asChild>
            <Link to="/paiements/nouveau">
              <Plus className="mr-2 h-4 w-4" /> Nouveau paiement
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total encaissé (validé)</p>
          <p className="text-xl font-bold text-success">{formatFCFA(total)}</p>
        </CardContent>
      </Card>

      <PaiementsEnAttenteCard exerciceId={exerciceId} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_PAIEMENT.map((s) => (
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
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ml-1 rounded-full hover:bg-muted"
                aria-label="Retirer le filtre de recherche"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statutFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Statut : {STATUT_PAIEMENT_LABEL[statutFilter]?.label ?? statutFilter}
              <button
                type="button"
                onClick={() => setStatutFilter("all")}
                className="ml-1 rounded-full hover:bg-muted"
                aria-label="Retirer le filtre de statut"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={resetAllFilters}>
            <RotateCcw className="mr-1 h-3 w-3" /> Réinitialiser
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
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
              ) : paiements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6">
                    <EmptyState
                      variant={hasActiveFilters ? "compact" : "rich"}
                      icon={CreditCard}
                      title={
                        hasActiveFilters
                          ? "Aucun paiement ne correspond aux filtres appliqués."
                          : "Aucun paiement enregistré pour cet exercice."
                      }
                      description={
                        hasActiveFilters
                          ? undefined
                          : "Enregistrez un encaissement pour marquer une facture comme payée et alimenter l'état de compte du client."
                      }
                      onReset={hasActiveFilters ? resetAllFilters : undefined}
                      action={
                        !hasActiveFilters ? (
                          <Button asChild size="sm">
                            <Link to="/paiements/nouveau">
                              <Plus className="mr-2 h-4 w-4" /> Nouveau paiement
                            </Link>
                          </Button>
                        ) : undefined
                      }
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paiements.map((p) => {
                  const statutMeta = STATUT_PAIEMENT_LABEL[p.statut];
                  return (
                    <TableRow key={p.paiement_id}>
                      <TableCell className="font-mono text-xs">{formatDocumentReference(p.reference)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.date_paiement)}</TableCell>
                      <TableCell className="font-medium">{p.client_nom ?? "—"}</TableCell>
                      <TableCell>
                        {MODE_PAIEMENT_LABEL[p.mode_paiement] ?? p.mode_paiement}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFCFA(Number(p.montant))}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            style={{ color: statutMeta?.color, borderColor: statutMeta?.color }}
                          >
                            {statutMeta?.label ?? p.statut}
                          </Badge>
                          {(p.statut === "en_attente" ||
                            p.statut === "en_attente_validation") && (
                            <Link
                              to="/approbations"
                              className="inline-flex items-center rounded-full border border-warning px-2 py-0.5 text-[10px] font-medium text-warning hover:bg-warning/10"
                              title="En attente d'approbation — voir le centre"
                            >
                              ⏳ Approbation
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.statut !== "annule" && (
                          <Button aria-label="Annuler ce paiement"
                            asChild
                            variant="ghost"
                            size="icon"
                            title="Annuler ce paiement"
                          >
                            <Link
                              to="/paiements/$paiementId"
                              params={{ paiementId: p.paiement_id }}
                            >
                              <Ban className="h-4 w-4 text-destructive" />
                            </Link>
                          </Button>
                        )}
                        <Button aria-label="Télécharger le reçu PDF"
                          variant="ghost"
                          size="icon"
                          title="Télécharger le reçu PDF"
                          onClick={async () => {
                            try {
                              const ctx = await getRecuContext(p.paiement_id);
                              const montant = Number(ctx.paiement.montant);
                              const totalFacture = ctx.facture?.montant_total ?? null;
                              
                              const balanceBefore = ctx.balanceBefore ?? (ctx.facture != null ? Number(ctx.facture.montant_total) - (Number(ctx.facture.montant_paye) - montant) : null);
                              const dejaPayeAvant = totalFacture !== null && balanceBefore !== null ? totalFacture - balanceBefore : null;

                              const blob = await generateRecuPaiementPDF({
                                id: ctx.paiement.paiement_id,
                                reference: ctx.paiement.reference,
                                date: ctx.paiement.date_paiement,
                                clientNom: ctx.client?.nom ?? ctx.paiement.client_nom,
                                codeClient: ctx.client?.reference ?? null,
                                clientTel: ctx.client?.telephone ?? null,
                                adresseClient: ctx.client?.adresse ?? null,
                                villeClient: ctx.client?.ville ?? null,
                                representant: ctx.client?.representant ?? null,
                                modePaiement:
                                  MODE_PAIEMENT_LABEL[ctx.paiement.mode_paiement] ??
                                  ctx.paiement.mode_paiement,
                                totalTTC: montant,
                                factureReference: ctx.facture?.reference ?? undefined,
                                factureMontantTotal: totalFacture,
                                factureMontantPayeAvant: dejaPayeAvant,
                                balanceBefore: balanceBefore,
                                observations: ctx.paiement.notes,
                                devise: "FCFA",
                              } as any);
                              downloadBlob(blob, fileNameFor(p.reference, p.client_nom));
                            } catch (e) {
                              toast.error(friendlyError(e, "Erreur PDF"));
                            }
                          }}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {canHardDelete && (
                          <Button aria-label="Supprimer définitivement"
                            variant="ghost"
                            size="icon"
                            title="Supprimer définitivement"
                            onClick={() => {
                              setDeleteMotif("");
                              setDeleteTarget({ id: p.paiement_id, ref: p.reference });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteMotif("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Action irréversible réservée aux super-admins et directeurs généraux.
              {deleteTarget && ` Paiement ${deleteTarget.ref} sera effacé de la base.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="motif-del-list">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motif-del-list"
              value={deleteMotif}
              onChange={(e) => setDeleteMotif(e.target.value)}
              placeholder="Justification (doublon, saisie test, etc.)"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deleteMotif.trim()) {
                  toast.error("Motif obligatoire");
                  return;
                }
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending || !deleteMotif.trim()}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
