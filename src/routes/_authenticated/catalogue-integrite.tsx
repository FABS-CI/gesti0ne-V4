import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Download,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
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

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${color}1a`, color }}
        >
          {icon}
        </div>
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
            <ShieldCheck className="h-6 w-6 text-[#FF6200]" />
            Contrôle d'intégrité du catalogue
          </h1>
          <p className="text-sm text-muted-foreground">
            Validation des ISBN et des prix d'achat de tous les articles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Relancer
          </Button>
          <Button onClick={exportReport} disabled={!data || data.problemes.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Analyse du catalogue en cours…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Articles analysés"
              value={data.total}
              color="#3B82F6"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Conformes"
              value={data.conformes}
              color="#10B981"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="ISBN à corriger"
              value={data.parChamp.isbn}
              color="#EF4444"
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <StatCard
              label="Prix à corriger"
              value={data.parChamp.prix_achat + data.parChamp.prix_vente}
              color="#F97316"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Articles incomplets ({data.problemes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {data.problemes.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-[#10B981]/10 p-4 text-[#10B981]">
                  <CheckCircle2 className="h-5 w-5" />
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
