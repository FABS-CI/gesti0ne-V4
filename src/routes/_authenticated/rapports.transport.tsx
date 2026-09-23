import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import {
  getRapportFraisTransport,
  type FraisTransportFilters,
} from "@/lib/frais-transport-api";

export const Route = createFileRoute("/_authenticated/rapports/transport")({
  component: RapportTransportPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  head: () => ({
    meta: [
      { title: "Frais de transport | FABS-CI" },
      {
        name: "description",
        content:
          "Analyse des frais de livraison et d'expédition facturés : totaux, évolution et détail par client.",
      },
      { property: "og:title", content: "Frais de transport | FABS-CI" },
      {
        property: "og:description",
        content: "Totaux, évolution et détail des frais de livraison et d'expédition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const frDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR") : "—";

const LABEL_TYPE: Record<string, string> = {
  livraison: "Livraison",
  expedition: "Expédition",
};

function RapportTransportPage() {
  const exerciceId = useExerciceConsulteId();
  const [dateDu, setDateDu] = useState("");
  const [dateAu, setDateAu] = useState("");
  const [type, setType] = useState<"tous" | "livraison" | "expedition">("tous");
  const [statut, setStatut] = useState<string>("tous");
  const [granularite, setGranularite] =
    useState<NonNullable<FraisTransportFilters["granularite"]>>("mois");

  const filters: FraisTransportFilters = {
    dateDu: dateDu || null,
    dateAu: dateAu || null,
    type: type === "tous" ? null : type,
    statut: statut === "tous" ? null : statut,
    exerciceId: exerciceId ?? null,
    granularite,
  };

  const q = useQuery({
    queryKey: ["rapport-frais-transport", filters],
    queryFn: () => getRapportFraisTransport(filters),
    staleTime: 60_000,
  });

  const d = q.data;

  function exporter() {
    if (!d) return;
    exportCsv(
      "Frais de transport",
      ["Référence", "Date", "Client", "Type", "Montant", "Statut"],
      d.lignes.map((l) => [
        l.reference ?? "",
        frDate(l.date_facture),
        l.client_nom ?? "",
        LABEL_TYPE[l.type_frais_transport ?? ""] ?? "",
        formatFCFA(l.montant_frais_transport),
        l.statut ?? "",
      ]),
      {
        pageTitle: "Rapport des frais de transport",
        summary: [
          { label: "Total", value: formatFCFA(d.kpi.total) },
          { label: "Livraison", value: formatFCFA(d.kpi.livraison) },
          { label: "Expédition", value: formatFCFA(d.kpi.expedition) },
          { label: "Factures concernées", value: String(d.kpi.nb_factures) },
        ],
      },
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Truck className="h-6 w-6 text-primary" /> Frais de transport
        </h1>
        <Button variant="outline" onClick={exporter} disabled={!d}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="ft-du">Du</Label>
            <Input
              id="ft-du"
              type="date"
              value={dateDu}
              onChange={(e) => setDateDu(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ft-au">Au</Label>
            <Input
              id="ft-au"
              type="date"
              value={dateAu}
              onChange={(e) => setDateAu(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous</SelectItem>
                <SelectItem value="livraison">Livraison</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Statut facture</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous</SelectItem>
                <SelectItem value="impayee">Non payée</SelectItem>
                <SelectItem value="partiellement_payee">Partiellement payée</SelectItem>
                <SelectItem value="payee">Payée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Regroupement</Label>
            <Select
              value={granularite}
              onValueChange={(v) => setGranularite(v as typeof granularite)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jour">Jour</SelectItem>
                <SelectItem value="semaine">Semaine</SelectItem>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {q.isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {q.isError && (
        <p className="text-destructive">
          Impossible de charger le rapport des frais de transport.
        </p>
      )}

      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total frais de transport", value: formatFCFA(d.kpi.total) },
              { label: "Frais de livraison", value: formatFCFA(d.kpi.livraison) },
              { label: "Frais d'expédition", value: formatFCFA(d.kpi.expedition) },
              { label: "Moyenne par facture", value: formatFCFA(d.kpi.moyenne) },
            ].map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-bold">{k.value}</CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Évolution</CardTitle>
            </CardHeader>
            <CardContent>
              {d.periodes.length === 0 ? (
                <p className="text-muted-foreground">Aucun frais sur la période.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={d.periodes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatFCFA(Number(v))} />
                    <Legend />
                    <Bar dataKey="livraison" name="Livraison" fill="#1E3A8A" />
                    <Bar dataKey="expedition" name="Expédition" fill="#F97316" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Par client</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Aucune donnée
                      </TableCell>
                    </TableRow>
                  ) : (
                    d.clients.map((c) => (
                      <TableRow key={`${c.client_id}-${c.client_nom}`}>
                        <TableCell>{c.client_nom}</TableCell>
                        <TableCell className="text-right">{c.nb}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatFCFA(c.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détail des factures ({d.lignes.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.lignes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun frais de transport sur la période
                      </TableCell>
                    </TableRow>
                  ) : (
                    d.lignes.map((l, i) => (
                      <TableRow key={`${l.facture_id ?? i}`}>
                        <TableCell className="font-medium">{l.reference}</TableCell>
                        <TableCell>{frDate(l.date_facture)}</TableCell>
                        <TableCell>{l.client_nom}</TableCell>
                        <TableCell>
                          {LABEL_TYPE[l.type_frais_transport ?? ""] ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatFCFA(l.montant_frais_transport)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
