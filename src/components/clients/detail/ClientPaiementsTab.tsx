import { formatDocumentReference } from "@/lib/document-reference";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyRow } from "./shared";
import { frDate } from "@/lib/client-detail-helpers";
import { formatFCFA } from "@/lib/format";
import type { ClientRelations } from "@/lib/clients-api";
import { useNavigate } from "@tanstack/react-router";

type SortKey = "date" | "reference" | "mode" | "statut" | "montant";

const HEADERS = [
  { k: "reference" as const, label: "Référence", align: "left" as const },
  { k: "date" as const, label: "Date", align: "left" as const },
  { k: "mode" as const, label: "Mode", align: "left" as const },
  { k: "statut" as const, label: "Statut", align: "left" as const },
  { k: "montant" as const, label: "Montant", align: "right" as const },
];

export function ClientPaiementsTab({ paiements }: { paiements: ClientRelations["paiements"] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = paiements.filter((p) =>
    search.trim() ? p.reference.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "date":
        return (new Date(a.date_paiement).getTime() - new Date(b.date_paiement).getTime()) * dir;
      case "reference":
        return a.reference.localeCompare(b.reference) * dir;
      case "mode":
        return a.mode_paiement.localeCompare(b.mode_paiement) * dir;
      case "statut":
        return a.statut.localeCompare(b.statut) * dir;
      case "montant":
        return (Number(a.montant) - Number(b.montant)) * dir;
    }
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const list = sorted.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par référence…"
          className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Rechercher un paiement par référence"
        />
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {HEADERS.map((h) => {
                const active = sortKey === h.k;
                const ariaSort: "ascending" | "descending" | "none" = active
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <TableHead
                    key={h.k}
                    aria-sort={ariaSort}
                    className={h.align === "right" ? "text-right" : undefined}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      onClick={() => {
                        if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setSortKey(h.k);
                          setSortDir("asc");
                        }
                      }}
                      aria-label={`Trier par ${h.label}`}
                    >
                      {h.label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!list.length ? (
              <EmptyRow
                cols={5}
                label={search ? "Aucun paiement correspondant" : "Aucun paiement"}
              />
            ) : (
              list.map((p) => (
                <TableRow
                  key={p.paiement_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({
                      to: "/paiements/$paiementId",
                      params: { paiementId: p.paiement_id },
                    })
                  }
                >
                  <TableCell className="font-mono text-xs text-primary underline-offset-2 hover:underline">
                    {formatDocumentReference(p.reference)}
                  </TableCell>
                  <TableCell>{frDate(p.date_paiement)}</TableCell>
                  <TableCell>{p.mode_paiement}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.statut}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatFCFA(p.montant)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} / {totalPages} — {sorted.length} paiement
            {sorted.length > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Préc.
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Suiv. <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
