import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Printer,
  Tag,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";

import {
  getIncident,
  getIncidentLignes,
  annulerIncident,
  TYPE_INCIDENT_LABEL,
  STATUT_INCIDENT_LABEL,
} from "@/lib/incidents-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { usePermissions } from "@/hooks/use-permissions";
import { buildIncidentPdfBlob, incidentPdfFilename } from "@/lib/incidents-pdf";
import { printCached, viewCached } from "@/lib/pdf/actions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/incidents/$incidentId")({
  component: IncidentDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { has } = usePermissions();
  const canCancel = has("incidents.annuler");

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => getIncident(incidentId),
  });
  const { data: lignes = [] } = useQuery({
    queryKey: ["incident-lignes", incidentId],
    queryFn: () => getIncidentLignes(incidentId),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("print") === "1" && incident) {
      const t = setTimeout(() => {
        printCached(`incident-${incidentId}`, () => buildIncidentPdfBlob(incidentId), {
          title: `Incident ${incident.numero ?? incident.reference}`,
          filename: incidentPdfFilename(incident.numero ?? incident.reference),
        });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [incident, incidentId]);

  const cancelMut = useMutation({
    mutationFn: () => annulerIncident(incidentId),
    onSuccess: () => {
      toast.success("Incident annulé, stock restitué");
      qc.invalidateQueries({ queryKey: ["incident", incidentId] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setConfirmCancel(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!incident)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Incident introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/incidents">Retour</Link>
        </Button>
      </div>
    );

  const st = STATUT_INCIDENT_LABEL[incident.statut];
  const typeLabel = TYPE_INCIDENT_LABEL[incident.type_incident] ?? incident.type_incident;
  const qteTotale = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/incidents">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <div>
            <h1 className="ds-page-title">Incident {incident.numero ?? incident.reference}</h1>
            <p className="text-sm text-muted-foreground">{typeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {st && (
            <Badge style={{ backgroundColor: st.color }} className="text-white">
              {st.label}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              viewCached(`incident-${incidentId}`, () => buildIncidentPdfBlob(incidentId), {
                title: `Incident ${incident.numero ?? incident.reference}`,
                filename: incidentPdfFilename(incident.numero ?? incident.reference),
              })
            }
          >
            <Printer className="h-4 w-4 mr-2" /> Imprimer PDF
          </Button>
          {canCancel && incident.statut !== "annule" && (
            <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
              <XCircle className="h-4 w-4 mr-2 text-red-600" /> Annuler l'incident
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" /> Type
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{typeLabel}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(incident.date_incident)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Warehouse className="h-4 w-4" /> Magasin
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{incident.depots?.nom ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Responsable
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {incident.responsable_nom ?? "—"}
            <p className="text-xs text-muted-foreground mt-1">{frDate(incident.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fiche d'impression */}
      <div className="rounded-md border bg-card p-6 space-y-4 print:border-none print:p-0">
        <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="ds-page-title">FABS-CI</h1>
            <p className="text-sm">Fiche d'Incident de Stock</p>
          </div>
          <div className="text-right text-xs">
            <p>
              <strong>N° :</strong> {incident.numero ?? incident.reference}
            </p>
            <p>
              <strong>Date :</strong> {frDate(incident.date_incident)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Numéro</p>
            <p className="font-mono font-semibold">{incident.numero ?? incident.reference}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-semibold">{frDate(incident.date_incident)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Magasin / Entrepôt</p>
            <p className="font-semibold">{incident.depots?.nom ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Responsable</p>
            <p className="font-semibold">{incident.responsable_nom ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Type d'incident</p>
            <p className="font-semibold">{typeLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Statut</p>
            <p className="font-semibold">{st?.label ?? incident.statut}</p>
          </div>
          {incident.motif && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Motif</p>
              <p className="whitespace-pre-wrap">{incident.motif}</p>
            </div>
          )}
          {incident.observations && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Observations</p>
              <p className="whitespace-pre-wrap">{incident.observations}</p>
            </div>
          )}
        </div>

        <div className="pt-2">
          <h3 className="font-semibold mb-2">Produits concernés ({lignes.length})</h3>
          {lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune ligne enregistrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell className="font-medium">{l.designation}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.reference_produit ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{l.quantite}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-bold">{qteTotale}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>

        {/* Signatures */}
        <div className="grid gap-8 sm:grid-cols-2 pt-12">
          <div className="border-t pt-2 text-sm">
            <p className="font-semibold">Responsable ayant déclaré</p>
            <p className="text-muted-foreground">{incident.responsable_nom ?? ""}</p>
            <p className="text-xs text-muted-foreground mt-8">Signature</p>
          </div>
          <div className="border-t pt-2 text-sm">
            <p className="font-semibold">Gestionnaire de stock</p>
            <p className="text-xs text-muted-foreground mt-8">Signature</p>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
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
            <AlertDialogAction onClick={() => cancelMut.mutate()}>
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
