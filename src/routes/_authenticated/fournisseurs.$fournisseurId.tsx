import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, MapPin, Phone, User } from "lucide-react";

import { getFournisseur, getFournisseurAchats } from "@/lib/fournisseurs-api";
import { STATUT_ACHAT_LABEL, type Achat } from "@/lib/achats-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { useReportANouveau } from "@/hooks/use-report-a-nouveau";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/fournisseurs/$fournisseurId")({
  component: FournisseurDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? formatDate(d) : "—";
}

function FournisseurDetailPage() {
  const { fournisseurId } = Route.useParams();
  const { data: report } = useReportANouveau("fournisseur", fournisseurId);
  const { data: fournisseur, isLoading } = useQuery({
    queryKey: ["fournisseur", fournisseurId],
    queryFn: () => getFournisseur(fournisseurId),
  });
  const { data: achats = [] } = useQuery({
    queryKey: ["fournisseur-achats", fournisseurId],
    queryFn: () => getFournisseurAchats(fournisseurId) as Promise<Achat[]>,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!fournisseur)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Fournisseur introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/fournisseurs">Retour</Link>
        </Button>
      </div>
    );

  const totalAchats = achats.reduce((s, a) => s + (a.montant ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button aria-label="Retour" asChild variant="ghost" size="icon">
            <Link to="/fournisseurs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="ds-page-title">{fournisseur.raison_sociale}</h1>
            <p className="text-sm text-muted-foreground">{fournisseur.ville ?? "—"}</p>
          </div>
        </div>
        <Badge variant={fournisseur.actif ? "secondary" : "destructive"}>
          {fournisseur.actif ? "Actif" : "Inactif"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Représentant
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{fournisseur.representant ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" /> Téléphone
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{fournisseur.telephone ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> Email
            </CardTitle>
          </CardHeader>
          <CardContent className="truncate font-medium">{fournisseur.email ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Total achats
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(totalAchats)}
          </CardContent>
        </Card>
      </div>

      {report && report.montant !== 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {report.montant < 0 ? "Report à-nouveau (avance)" : "Report à-nouveau (dû)"}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-lg font-bold ${report.montant > 0 ? "text-destructive" : "text-success"}`}
          >
            {formatFCFA(Math.abs(report.montant))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="achats">Achats ({achats.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" /> Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
              {fournisseur.adresse || "Non renseignée"}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achats">
          <Card>
            <CardHeader>
              <CardTitle>Historique des achats</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {achats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun achat
                      </TableCell>
                    </TableRow>
                  ) : (
                    achats.map((a) => {
                      const st = STATUT_ACHAT_LABEL[a.statut];
                      return (
                        <TableRow key={a.achat_id}>
                          <TableCell>{a.reference}</TableCell>
                          <TableCell>{a.libelle}</TableCell>
                          <TableCell>{frDate(a.date_achat)}</TableCell>
                          <TableCell>
                            {st && (
                              <Badge style={{ backgroundColor: st.color }} className="text-white">
                                {st.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatFCFA(a.montant)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
