import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { exportCsv } from "@/lib/export-csv";
import { formatFCFA, formatDate } from "@/lib/format";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/rapports-logistique")({
  component: RapportsLogistique,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Row = {
  tournee_id: string;
  reference: string;
  date_tournee: string | null;
  responsable_nom: string | null;
  chauffeur_nom: string | null;
  statut: string;
  cout_carburant: number;
  cout_peages: number;
  cout_repas: number;
  cout_expeditions: number;
  cout_manutentions: number;
  cout_autres: number;
  cout_total: number;
  nb_colis: number;
  nb_cartons: number;
  nb_clients: number;
};

const STATUTS = ["", "preparee", "en_cours", "terminee", "annulee"];

function RapportsLogistique() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today);
  const [statut, setStatut] = useState("");
  const [chauffeur, setChauffeur] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["rapports-logistique", from, to, statut, chauffeur],
    queryFn: async () => {
      let q = supabase.from("tournees").select("*");
      if (from) q = q.gte("date_tournee", from);
      if (to) q = q.lte("date_tournee", to);
      if (statut) q = q.eq("statut", statut);
      if (chauffeur) q = q.ilike("chauffeur_nom", `%${chauffeur}%`);
      const { data, error } = await q
        .order("date_tournee", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const totaux = useMemo(() => {
    const t = { cout: 0, colis: 0, cartons: 0, clients: 0 };
    rows.forEach((r) => {
      t.cout += Number(r.cout_total ?? 0);
      t.colis += Number(r.nb_colis ?? 0);
      t.cartons += Number(r.nb_cartons ?? 0);
      t.clients += Number(r.nb_clients ?? 0);
    });
    return t;
  }, [rows]);

  const handleExport = () => {
    const headers = [
      "Référence",
      "Date",
      "Responsable",
      "Chauffeur",
      "Statut",
      "Carburant",
      "Péages",
      "Repas",
      "Expéditions",
      "Manutentions",
      "Autres",
      "Total",
      "Colis",
      "Cartons",
      "Clients",
    ];
    const data = rows.map((r) => [
      r.reference,
      r.date_tournee ?? "",
      r.responsable_nom ?? "",
      r.chauffeur_nom ?? "",
      r.statut,
      r.cout_carburant,
      r.cout_peages,
      r.cout_repas,
      r.cout_expeditions,
      r.cout_manutentions,
      r.cout_autres,
      r.cout_total,
      r.nb_colis,
      r.nb_cartons,
      r.nb_clients,
    ]);
    exportCsv(`rapport-tournees-${from}_${to}.csv`, headers, data, {
      pageTitle: "RAPPORT DES TOURNÉES",
      summary: [
        { label: "Nombre de tournées", value: String(rows.length) },
        { label: "Coût total", value: formatFCFA(totaux.cout) },
        { label: "Colis livrés", value: String(totaux.colis) },
        { label: "Cartons livrés", value: String(totaux.cartons) },
        { label: "Clients servis", value: String(totaux.clients) },
      ],
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Rapports logistique
          </h1>
          <p className="text-sm text-muted-foreground">Analyse des tournées et coûts par période</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Exporter PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <div>
            <Label>Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={statut || "all"} onValueChange={(v) => setStatut(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {STATUTS.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chauffeur</Label>
            <Input
              placeholder="Nom…"
              value={chauffeur}
              onChange={(e) => setChauffeur(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tournées" value={String(rows.length)} />
        <Kpi label="Coût total" value={formatFCFA(totaux.cout)} />
        <Kpi label="Colis" value={String(totaux.colis)} />
        <Kpi label="Cartons" value={String(totaux.cartons)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Colis</TableHead>
                  <TableHead className="text-right">Cartons</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucune tournée
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.tournee_id}>
                      <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                      <TableCell>{formatDate(r.date_tournee)}</TableCell>
                      <TableCell>{r.chauffeur_nom ?? "—"}</TableCell>
                      <TableCell>{r.statut}</TableCell>
                      <TableCell className="text-right">{r.nb_colis}</TableCell>
                      <TableCell className="text-right">{r.nb_cartons}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatFCFA(Number(r.cout_total))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
