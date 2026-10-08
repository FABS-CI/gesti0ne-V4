import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { listAlertesStock, listDepots } from "@/lib/depots-api";
import { exportCsv } from "@/lib/export-csv";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/alertes-stock")({
  component: AlertesStockPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const SEV_LABEL: Record<
  string,
  { label: string; variant: "destructive" | "secondary" | "default" }
> = {
  rupture: { label: "Rupture", variant: "destructive" },
  critique: { label: "Critique", variant: "destructive" },
  bas: { label: "Bas", variant: "secondary" },
};

function AlertesStockPage() {
  const [q, setQ] = useState("");
  const [depotFilter, setDepotFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");

  const { data: depots = [] } = useQuery({ queryKey: ["depots"], queryFn: listDepots });
  const { data: alertes = [], isLoading } = useQuery({
    queryKey: ["alertes-stock"],
    queryFn: listAlertesStock,
  });

  const rows = useMemo(
    () =>
      alertes.filter(
        (a) =>
          (!depotFilter || a.depot_id === depotFilter) &&
          (!sevFilter || a.severite === sevFilter) &&
          (!q ||
            a.titre.toLowerCase().includes(q.toLowerCase()) ||
            (a.reference ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [alertes, q, depotFilter, sevFilter],
  );

  const counts = useMemo(
    () => ({
      rupture: alertes.filter((a) => a.severite === "rupture").length,
      critique: alertes.filter((a) => a.severite === "critique").length,
      bas: alertes.filter((a) => a.severite === "bas").length,
    }),
    [alertes],
  );

  function onExport() {
    exportCsv(
      "alertes-stock",
      ["Sévérité", "Dépôt", "Référence", "Désignation", "Quantité", "Seuil"],
      rows.map((r) => [
        SEV_LABEL[r.severite].label,
        r.depot_nom,
        r.reference ?? "",
        r.titre,
        r.quantite,
        r.seuil,
      ]),
      {
        pageTitle: "ALERTES DE STOCK",
        summary: [
          { label: "Nombre total d'alertes", value: String(rows.length) },
          { label: "Ruptures", value: String(counts.rupture) },
          { label: "Alertes critiques", value: String(counts.critique) },
          { label: "Stocks bas", value: String(counts.bas) },
          {
            label: "Dépôts concernés",
            value: String(new Set(rows.map((r) => r.depot_id)).size),
          },
        ],
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-[#EF4444]" />
          <div>
            <h1 className="ds-page-title">Alertes de stock par dépôt</h1>
            <p className="text-sm text-muted-foreground">
              Produits sous seuil — seuil dépôt prioritaire, sinon seuil produit
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["rupture", "critique", "bas"] as const).map((sev) => (
          <Card key={sev}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground">
                {SEV_LABEL[sev].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{counts[sev]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-md border bg-card p-4">
        <Input
          placeholder="Rechercher (référence, désignation)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-72"
        />
        <Select
          value={depotFilter || "__all"}
          onValueChange={(v) => setDepotFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Tous les dépôts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Tous les dépôts</SelectItem>
            {depots.map((d) => (
              <SelectItem key={d.depot_id} value={d.depot_id}>
                {d.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sevFilter || "__all"}
          onValueChange={(v) => setSevFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Toutes sévérités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Toutes sévérités</SelectItem>
            <SelectItem value="rupture">Rupture</SelectItem>
            <SelectItem value="critique">Critique</SelectItem>
            <SelectItem value="bas">Bas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sévérité</TableHead>
                <TableHead>
                  <Warehouse className="inline h-3.5 w-3.5 mr-1" /> Dépôt
                </TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Seuil</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Aucune alerte 
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={`${r.depot_id}-${r.produit_id}`}>
                    <TableCell>
                      <Badge variant={SEV_LABEL[r.severite].variant}>
                        {SEV_LABEL[r.severite].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.depot_nom}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                    <TableCell>{r.titre}</TableCell>
                    <TableCell className="text-right font-semibold">{r.quantite}</TableCell>
                    <TableCell className="text-right">{r.seuil}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/produits/$produitId" params={{ produitId: r.produit_id }}>
                          Voir
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>
    </div>
  );
}
