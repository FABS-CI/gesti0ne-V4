import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listFNELogs } from "@/lib/fne-api";
import { exportPdf } from "@/lib/export-csv";

export function FNELogsPanel() {
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fne-logs"],
    queryFn: () => listFNELogs(500),
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows.filter((r) => {
      if (statutFilter !== "all" && r.statut !== statutFilter) return false;
      if (dateFrom && r.created_at && r.created_at < dateFrom) return false;
      if (dateTo && r.created_at && r.created_at > dateTo + "T23:59:59") return false;
      if (!s) return true;
      return [r.action, r.statut, r.fne_facture_id].some((v) =>
        (v ?? "").toString().toLowerCase().includes(s),
      );
    });
  }, [rows, q, statutFilter, dateFrom, dateTo]);

  const handleExportPdf = () => {
    const headers = [
      "Horodatage",
      "Facture FNE",
      "Action",
      "Statut",
      "HTTP",
      "Tentative",
      "Durée (ms)",
      "Utilisateur",
    ];
    const keys = [
      "created_at",
      "fne_facture_id",
      "action",
      "statut",
      "http_status",
      "attempt_number",
      "duration_ms",
      "user_nom",
    ] as const;
    const rows = filtered.map((r) =>
      keys.map((k) => {
        const v = k === "user_nom" ? null : r[k];
        return v == null ? "" : String(v);
      }),
    );
    exportPdf(`fne_logs_${new Date().toISOString().slice(0, 10)}`, headers, rows, {
      pageTitle: "Historique des appels FNE",
    });
  };

  return (
    <div className="pt-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Historique des appels FNE</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 w-56"
                placeholder="Recherche…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <select
                className="border rounded-md h-9 px-2 text-sm bg-background block"
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value)}
              >
                <option value="all">Tous</option>
                <option value="succes">Succès</option>
                <option value="echec">Échec</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Du</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Au</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horodatage</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Facture FNE</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Aucun log
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">—</TableCell>
                    <TableCell className="font-mono text-xs">{r.fne_facture_id ?? "—"}</TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.statut === "succes"
                            ? "default"
                            : r.statut === "echec"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.http_status ?? "—"}</TableCell>
                    <TableCell>{r.duration_ms ? `${r.duration_ms} ms` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
