import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCrmDashboard } from "@/lib/crm-api";
import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const CrmCharts = lazy(() => import("@/components/clients/CrmCharts"));

export const Route = createFileRoute("/_authenticated/clients/dashboard")({
  component: CrmDashboardPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function CrmDashboardPage() {
  const today = new Date();
  const twelveMoAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const [from, setFrom] = useState(twelveMoAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["crm-dashboard", from, to],
    queryFn: () => getCrmDashboard(from, to),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> CRM & Analyses commerciales
          </h1>
          <p className="text-sm text-muted-foreground">
            Ventes, segmentation clients, produits phares — temps réel
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="CA (encaissé)" value={formatFCFA(data?.ca_total ?? 0)} />
        <Kpi label="Montant facturé" value={formatFCFA(data?.montant_facture ?? 0)} />
        <Kpi label="Reste à encaisser" value={formatFCFA(data?.reste_a_encaisser ?? 0)} />
        <Kpi label="Taux encaissement" value={`${(data?.taux_encaissement ?? 0).toFixed(1)}%`} />
        <Kpi label="Commandes" value={String(data?.nb_commandes ?? 0)} />
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CrmCharts data={data} />
        </Suspense>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          title="Top 20 clients"
          rows={(data?.top_clients ?? []).map((c) => ({
            label: c.client_nom,
            sub: `${c.type_client ?? ""} • ${c.ville ?? ""}`.trim(),
            value: c.ca,
            count: c.nb,
          }))}
          onExport={() =>
            exportCsv(
              "top_clients",
              ["Client", "Type", "Ville", "CA", "Commandes"],
              (data?.top_clients ?? []).map((c) => [
                c.client_nom,
                c.type_client ?? "",
                c.ville ?? "",
                c.ca,
                c.nb,
              ]),
              {
                pageTitle: "TOP 20 CLIENTS",
                summary: [
                  { label: "Clients classés", value: String((data?.top_clients ?? []).length) },
                  {
                    label: "CA cumulé",
                    value:
                      formatFCFA((data?.top_clients ?? [])
                        .reduce((s, c) => s + Number(c.ca || 0), 0)),
                  },
                ],
              },
            )
          }
        />
        <RankingCard
          title="Top représentants"
          rows={(data?.top_representants ?? []).map((r) => ({
            label: r.label,
            value: r.ca,
            count: r.nb_clients,
            countLabel: "clients",
          }))}
          onExport={() =>
            exportCsv(
              "top_representants",
              ["Représentant", "CA", "Clients"],
              (data?.top_representants ?? []).map((r) => [r.label, r.ca, r.nb_clients]),
              {
                pageTitle: "TOP REPRÉSENTANTS",
                summary: [
                  { label: "Représentants", value: String((data?.top_representants ?? []).length) },
                  {
                    label: "CA cumulé",
                    value:
                      formatFCFA((data?.top_representants ?? [])
                        .reduce((s, r) => s + Number(r.ca || 0), 0)),
                  },
                ],
              },
            )
          }
        />
        <RankingCard
          title="Produits les plus vendus"
          rows={(data?.top_produits ?? []).map((p) => ({
            label: p.label,
            value: p.ca,
            count: p.qte ?? 0,
            countLabel: "unités",
          }))}
          onExport={() =>
            exportCsv(
              "top_produits",
              ["Produit", "Quantité", "CA"],
              (data?.top_produits ?? []).map((p) => [p.label, p.qte ?? 0, p.ca]),
              {
                pageTitle: "PRODUITS LES PLUS VENDUS",
                summary: [
                  { label: "Produits classés", value: String((data?.top_produits ?? []).length) },
                  {
                    label: "Quantité totale",
                    value: String(
                      (data?.top_produits ?? []).reduce((s, p) => s + Number(p.qte ?? 0), 0),
                    ),
                  },
                  {
                    label: "CA cumulé",
                    value:
                      formatFCFA((data?.top_produits ?? [])
                        .reduce((s, p) => s + Number(p.ca || 0), 0)),
                  },
                ],
              },
            )
          }
        />
        <RankingCard
          title="Produits les moins vendus"
          rows={(data?.flop_produits ?? []).map((p) => ({
            label: p.label,
            value: p.ca,
            count: p.qte ?? 0,
            countLabel: "unités",
          }))}
          onExport={() =>
            exportCsv(
              "flop_produits",
              ["Produit", "Quantité", "CA"],
              (data?.flop_produits ?? []).map((p) => [p.label, p.qte ?? 0, p.ca]),
              {
                pageTitle: "PRODUITS LES MOINS VENDUS",
                summary: [
                  { label: "Produits classés", value: String((data?.flop_produits ?? []).length) },
                  {
                    label: "Quantité totale",
                    value: String(
                      (data?.flop_produits ?? []).reduce((s, p) => s + Number(p.qte ?? 0), 0),
                    ),
                  },
                  {
                    label: "CA cumulé",
                    value:
                      formatFCFA((data?.flop_produits ?? [])
                        .reduce((s, p) => s + Number(p.ca || 0), 0)),
                  },
                ],
              },
            )
          }
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

type Row = { label: string; sub?: string; value: number; count?: number; countLabel?: string };

function RankingCard({
  title,
  rows,
  onExport,
}: {
  title: string;
  rows: Row[];
  onExport?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">CA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Aucune donnée
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={r.label + i}>
                  <TableCell>
                    <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.label}</div>
                    {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.count ?? "—"}
                    {r.countLabel && r.count != null && (
                      <span className="ml-1 text-xs text-muted-foreground">{r.countLabel}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(r.value)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
