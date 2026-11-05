import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { controleIntegriteCatalogue } from "@/lib/produits-api";
import { exportCsv } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/catalogue-integrite")({
  component: IntegritePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${color}1a`, color }}
        ></div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegritePage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["catalogue-integrite"],
    queryFn: controleIntegriteCatalogue,
  });

  function exportReport() {
    if (!data) return;
    const headers = ["Référence", "Titre", "ISBN", "Prix d'achat", "Prix de vente", "Anomalies"];
    const rows = data.problemes.map((p) => [
      p.produit.reference,
      p.produit.titre,
      p.produit.isbn ?? "",
      p.produit.prix_achat ?? "",
      p.produit.prix_vente ?? "",
      p.issues.map((i) => `[${i.severite}] ${i.message}`).join(" | "),
    ]);
    const erreurs = data.problemes.filter((p) =>
      p.issues.some((i) => i.severite === "erreur"),
    ).length;
    const alertes = data.problemes.filter((p) =>
      p.issues.some((i) => i.severite === "alerte"),
    ).length;
    exportCsv("catalogue-articles-incomplets.csv", headers, rows, {
      pageTitle: "CONTRÔLE D'INTÉGRITÉ DU CATALOGUE",
      summary: [
        { label: "Articles avec anomalies", value: String(data.problemes.length) },
        { label: "Erreurs", value: String(erreurs) },
        { label: "Alertes", value: String(alertes) },
      ],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            Contrôle d'intégrité du catalogue
          </h1>
          <p className="text-sm text-muted-foreground">
            Validation des ISBN et des prix d'achat de tous les articles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Relancer
          </Button>
          <Button onClick={exportReport} disabled={!data || data.problemes.length === 0}>
            Exporter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Analyse du catalogue en cours…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Articles analysés" value={data.total} color="#3B82F6" />
            <StatCard label="Conformes" value={data.conformes} color="#10B981" />
            <StatCard label="ISBN à corriger" value={data.parChamp.isbn} color="#EF4444" />
            <StatCard
              label="Prix à corriger"
              value={data.parChamp.prix_achat + data.parChamp.prix_vente}
              color="#F97316"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Articles incomplets ({data.problemes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {data.problemes.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 p-4 text-success">
                  Tous les articles du catalogue sont conformes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>ISBN</TableHead>
                        <TableHead>Anomalies</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.problemes.map((p) => (
                        <TableRow key={p.produit.produit_id}>
                          <TableCell className="font-mono text-xs">{p.produit.reference}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {p.produit.titre}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.produit.isbn || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.issues.map((i, idx) => (
                                <Badge
                                  key={idx}
                                  variant={i.severite === "erreur" ? "destructive" : "secondary"}
                                  className="font-normal"
                                >
                                  {i.message}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            Corrigez les articles depuis le{" "}
            <Link to="/produits" className="font-medium text-[#FF6200] underline">
              catalogue produits
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
