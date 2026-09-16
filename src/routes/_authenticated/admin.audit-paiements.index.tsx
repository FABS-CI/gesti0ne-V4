import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, Search } from "lucide-react";

import { listPaiementAnnulationsAudit } from "@/lib/paiements-api";
import { formatFCFA } from "@/lib/format";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/audit-paiements/")({
  component: AuditPaiementsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR");
}

function AuditPaiementsPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["paiement-annulations-audit", q],
    queryFn: () => listPaiementAnnulationsAudit(q),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-primary" /> Journal d'audit — Annulations de paiement
        </h1>
        <p className="text-sm text-muted-foreground">
          Historique complet des paiements annulés (qui, quand, raison). Accès réservé aux
          administrateurs.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Accès refusé</AlertTitle>
          <AlertDescription>
            Vous devez être administrateur pour consulter ce journal.
          </AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher raison ou notes…"
          className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Rechercher dans les annulations"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annulations enregistrées ({data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Heure</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">Montant annulé</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Aucune annulation enregistrée
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {frDateTime(row.annule_le)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">
                            {row.paiement_reference ?? `${row.paiement_id.slice(0, 8)}…`}
                          </span>
                          {row.client_nom && (
                            <span className="block text-muted-foreground">{row.client_nom}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatFCFA(Number(row.montant_annule))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.annule_par_nom ??
                            (row.annule_par ? `${row.annule_par.slice(0, 8)}…` : "—")}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate" title={row.raison}>
                          {row.raison}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate" title={row.notes ?? ""}>
                          {row.notes ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/admin/audit-paiements/$auditId" params={{ auditId: row.id }}>
                              Détail
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
