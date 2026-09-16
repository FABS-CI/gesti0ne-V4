import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, User as UserIcon, Calendar, FileText } from "lucide-react";

import { getPaiementAnnulationAudit, getPaiement } from "@/lib/paiements-api";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/audit-paiements/$auditId")({
  component: AuditPaiementDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR");
}

function AuditPaiementDetailPage() {
  const { auditId } = Route.useParams();
  const {
    data: audit,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["paiement-annulation-audit", auditId],
    queryFn: () => getPaiementAnnulationAudit(auditId),
  });

  const { data: paiement } = useQuery({
    queryKey: ["paiement", audit?.paiement_id],
    queryFn: () => getPaiement(audit!.paiement_id),
    enabled: !!audit?.paiement_id,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Accès refusé</AlertTitle>
        <AlertDescription>Ce journal est réservé aux administrateurs.</AlertDescription>
      </Alert>
    );
  }

  if (!audit) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Entrée d'audit introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/admin/audit-paiements">Retour au journal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/admin/audit-paiements">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="h-5 w-5 text-primary" /> Détail annulation
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{audit.id}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date/Heure
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDateTime(audit.annule_le)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="h-4 w-4" /> Utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {audit.annule_par_nom ?? audit.annule_par ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> Montant annulé
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(Number(audit.montant_annule))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{paiement?.client_nom ?? "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raison</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm">{audit.raison}</CardContent>
      </Card>

      {audit.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {audit.notes}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/paiements/$paiementId" params={{ paiementId: audit.paiement_id }}>
            Voir le paiement
          </Link>
        </Button>
        {audit.facture_id && (
          <Button asChild variant="outline">
            <Link to="/factures/$factureId" params={{ factureId: audit.facture_id }}>
              Voir la facture
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
