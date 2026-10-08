import { formatDocumentReference } from "@/lib/document-reference";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listFNEInvoices } from "@/lib/fne-api";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { FneStatusBadge } from "@/components/fne/FneStatusBadge";

const FNE_ORANGE = "#FF6200";

const CHIPS: { key: string; label: string; color?: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "accepted", label: "Certifiées", color: "#10B981" },
  { key: "pending", label: "En attente", color: "#F59E0B" },
  { key: "submitted", label: "En cours", color: "#3B82F6" },
  { key: "rejected", label: "Rejetées", color: "#EF4444" },
  { key: "error", label: "Erreur", color: "#8B5CF6" },
];

export function FNEFacturesTab() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fne-list"],
    queryFn: () => listFNEInvoices({ limit: 100 }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (statut !== "all" && r.statut !== statut) return false;
      if (!q) return true;
      return [r.reference, r.code_dgi, r.client_nom].some((v) =>
        (v ?? "").toString().toLowerCase().includes(q),
      );
    });
  }, [rows, statut, search]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-end">
        <Button asChild style={{ backgroundColor: FNE_ORANGE, color: "#fff" }}>
          <Link to="/fne-nouvelle">
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle FNE
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Factures FNE</CardTitle>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 w-64"
                placeholder="Réf. / client / code DGI…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setStatut(c.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  statut === c.key
                    ? "text-white border-transparent"
                    : "bg-background hover:bg-muted text-muted-foreground"
                }`}
                style={statut === c.key ? { backgroundColor: c.color ?? "#334155" } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Code DGI</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Créée</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Aucune facture FNE
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow
                    key={r.fne_id}
                    className="cursor-pointer"
                    onClick={() =>
                      nav({ to: "/fne-detail/$factureId", params: { factureId: r.fne_id } })
                    }
                  >
                    <TableCell className="font-mono text-xs">{formatDocumentReference(r.reference)}</TableCell>
                    <TableCell>{r.client_nom ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code_dgi ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(Number(r.montant ?? 0))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.created_at ? formatDateTime(r.created_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <FneStatusBadge statut={r.statut ?? "pending"} />
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
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
