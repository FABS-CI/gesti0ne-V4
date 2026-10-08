import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, Search, Eye, Printer, XCircle, FileText, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  listIncidents,
  annulerIncident,
  TYPES_INCIDENT,
  TYPE_INCIDENT_LABEL,
  STATUTS_INCIDENT,
  STATUT_INCIDENT_LABEL,
} from "@/lib/incidents-api";
import { listDepots } from "@/lib/depots-api";
import { usePermissions } from "@/hooks/use-permissions";
import { buildRapportIncidentsPdfBlob } from "@/lib/incidents-pdf";
import { viewCached } from "@/lib/pdf/actions";
import { describeSupabaseError } from "@/lib/rbac-api";

import { authRouteHead } from "@/lib/route-head";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/incidents/")({
  head: () => authRouteHead("Incidents"),
  component: IncidentsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const PAGE_SIZE = 20;

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function IncidentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canManage = has("incidents.creer");
  const canCancel = has("incidents.annuler");

  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [depotId, setDepotId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: () => listDepots(),
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents", { q, statut, type, depotId }],
    queryFn: () =>
      listIncidents({
        q: q || undefined,
        statut: statut !== "all" ? statut : undefined,
        type: type !== "all" ? type : undefined,
        depot_id: depotId !== "all" ? depotId : undefined,
      }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => annulerIncident(id),
    onSuccess: () => {
      toast.success("Incident annulé, stock restitué");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setCancelId(null);
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return incidents.slice(start, start + PAGE_SIZE);
  }, [incidents, page]);
  const totalPages = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));

  const hasActiveFilters =
    !!q || statut !== "all" || type !== "all" || depotId !== "all";
  const resetAllFilters = () => {
    setQ("");
    setStatut("all");
    setType("all");
    setDepotId("all");
    setPage(1);
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-warning" />
          <div>
            <h1 className="ds-page-title">Incidents de Stock</h1>
            <p className="text-sm text-muted-foreground">
              Pertes, détériorations, obsolescences et autres sorties exceptionnelles
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const filtres = [
                  type !== "all" ? `Type=${TYPE_INCIDENT_LABEL[type] ?? type}` : null,
                  statut !== "all" ? `Statut=${STATUT_INCIDENT_LABEL[statut]?.label ?? statut}` : null,
                  depotId !== "all"
                    ? `Magasin=${depots.find((d) => d.depot_id === depotId)?.nom ?? depotId}`
                    : null,
                  q ? `Recherche="${q}"` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                viewCached(
                  `rapport-incidents-${q}-${statut}-${type}-${depotId}`,
                  () =>
                    buildRapportIncidentsPdfBlob({
                      q: q || undefined,
                      statut: statut !== "all" ? statut : undefined,
                      type: type !== "all" ? type : undefined,
                      depot_id: depotId !== "all" ? depotId : undefined,
                      periodeLabel: `Extraction du ${new Date().toLocaleDateString("fr-FR")}`,
                      filtresLabel: filtres || undefined,
                    }),
                  { title: "Rapport d'incidents", filename: "Rapport_incidents.pdf" },
                );
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Rapport PDF
            </Button>
            <Button onClick={() => navigate({ to: "/incidents/nouveau" })}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel Incident
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Numéro, référence, motif…"
            className="pl-8"
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPES_INCIDENT.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statut}
          onValueChange={(v) => {
            setStatut(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_INCIDENT.filter((s) => ["declare", "valide", "annule"].includes(s.value)).map(
              (s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select
          value={depotId}
          onValueChange={(v) => {
            setDepotId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Magasin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les dépôts</SelectItem>
            {depots.map((d) => (
              <SelectItem key={d.depot_id} value={d.depot_id}>
                {d.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FilterBadges
        badges={[
          ...(q ? [{ key: "q", label: `Recherche : ${q}`, onClear: () => { setQ(""); setPage(1); } } as FilterBadge] : []),
          ...(type !== "all"
            ? [{ key: "type", label: `Type : ${TYPE_INCIDENT_LABEL[type] ?? type}`, onClear: () => { setType("all"); setPage(1); } } as FilterBadge]
            : []),
          ...(statut !== "all"
            ? [{ key: "statut", label: `Statut : ${STATUT_INCIDENT_LABEL[statut]?.label ?? statut}`, onClear: () => { setStatut("all"); setPage(1); } } as FilterBadge]
            : []),
          ...(depotId !== "all"
            ? [{ key: "depot", label: `Magasin : ${depots.find((d) => d.depot_id === depotId)?.nom ?? depotId}`, onClear: () => { setDepotId("all"); setPage(1); } } as FilterBadge]
            : []),
        ]}
        onResetAll={resetAllFilters}
      />

      <div className="rounded-md border bg-card">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Nb produits</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead>Magasin</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6">
                    <EmptyState
                      variant={hasActiveFilters ? "compact" : "rich"}
                      icon={AlertTriangle}
                      title={
                        hasActiveFilters
                          ? "Aucun incident ne correspond aux filtres appliqués."
                          : "Aucun incident enregistré."
                      }
                      description={
                        hasActiveFilters
                          ? undefined
                          : "Consignez les incidents (livraison, qualité, sécurité) pour les tracer, les affecter et les résoudre."
                      }
                      onReset={hasActiveFilters ? resetAllFilters : undefined}
                      action={
                        !hasActiveFilters && canManage ? (
                          <Button size="sm" asChild>
                            <Link to="/incidents/nouveau">
                              <Plus className="mr-2 h-4 w-4" /> Nouvel incident
                            </Link>
                          </Button>
                        ) : undefined
                      }
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((inc) => {
                  const st = STATUT_INCIDENT_LABEL[inc.statut];
                  return (
                    <TableRow key={inc.incident_id}>
                      <TableCell className="font-mono text-xs">
                        {inc.numero ?? inc.reference}
                      </TableCell>
                      <TableCell>{frDate(inc.date_incident)}</TableCell>
                      <TableCell>
                        {TYPE_INCIDENT_LABEL[inc.type_incident] ?? inc.type_incident}
                      </TableCell>
                      <TableCell className="text-right">{inc.nb_produits}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {inc.total_quantite}
                      </TableCell>
                      <TableCell>{inc.depots?.nom ?? "—"}</TableCell>
                      <TableCell>{inc.responsable_nom ?? "—"}</TableCell>
                      <TableCell>
                        {st && (
                          <Badge style={{ backgroundColor: st.color }} className="text-white">
                            {st.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button aria-label="Consulter" asChild variant="ghost" size="icon" title="Consulter">
                            <Link
                              to="/incidents/$incidentId"
                              params={{ incidentId: inc.incident_id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button aria-label="Imprimer" asChild variant="ghost" size="icon" title="Imprimer">
                            <Link
                              to="/incidents/$incidentId"
                              params={{ incidentId: inc.incident_id }}
                              search={{ print: "1" } as never}
                            >
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canCancel && inc.statut !== "annule" && (
                            <Button aria-label="Annuler l'incident"
                              variant="ghost"
                              size="icon"
                              title="Annuler l'incident"
                              onClick={() => setCancelId(inc.incident_id)}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} / {totalPages} — {incidents.length} incident(s)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={cancelId !== null} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cet incident ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le stock des produits concernés sera automatiquement restitué dans le magasin et un
              mouvement d'entrée sera créé. L'incident sera marqué « Annulé ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelId && cancelMut.mutate(cancelId)}>
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
