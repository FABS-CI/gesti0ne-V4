import { Link } from "@tanstack/react-router";
import { ArrowUpDown, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import type { ComparatifRow } from "@/hooks/use-exercices-comparatif";
import type { SortKey } from "@/components/exercices/comparatif/ComparatifFilters";

type Props = {
  isLoading: boolean;
  rows: ComparatifRow[];
  hasSelection: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggleSort: (key: SortKey) => void;
  showPct: boolean;
  onSelectAll: () => void;
};

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Trier par ${label}${active ? (dir === "asc" ? " (croissant)" : " (décroissant)") : ""}`}
      className={`inline-flex items-center gap-1 rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${active ? "text-primary" : ""}`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
      {active && <span className="text-xs">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

function ariaSort(active: boolean, dir: "asc" | "desc"): "none" | "ascending" | "descending" {
  if (!active) return "none";
  return dir === "asc" ? "ascending" : "descending";
}

function KpiCell({
  exId,
  value,
  evol,
  bold,
}: {
  exId: string;
  value: number;
  evol: number | null;
  bold?: boolean;
}) {
  return (
    <TableCell className={`text-right ${bold ? "font-semibold" : ""}`}>
      <Link
        to="/exercices/rapport"
        search={{ exercice: exId }}
        className="flex flex-col items-end hover:text-primary hover:underline"
      >
        <span>{formatFCFA(value)}</span>
        {evol !== null && (
          <span className={`text-xs ${evol >= 0 ? "text-success" : "text-destructive"}`}>
            {evol >= 0 ? "+" : ""}
            {evol.toFixed(1)}%
          </span>
        )}
      </Link>
    </TableCell>
  );
}

export function ComparatifTable({
  isLoading,
  rows,
  hasSelection,
  sortKey,
  sortDir,
  onToggleSort,
  showPct,
  onSelectAll,
}: Props) {
  const evolution = (i: number, key: keyof ComparatifRow) => {
    if (i === 0 || !showPct) return null;
    const prev = Number(rows[i - 1][key]);
    const cur = Number(rows[i][key]);
    if (!prev) return null;
    return ((cur - prev) / prev) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synthèse par exercice</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={ariaSort(sortKey === "code", sortDir)}>
                <SortBtn
                  label="Exercice"
                  active={sortKey === "code"}
                  dir={sortDir}
                  onClick={() => onToggleSort("code")}
                />
              </TableHead>
              <TableHead className="text-right">Commandes</TableHead>
              <TableHead className="text-right">Factures</TableHead>
              <TableHead className="text-right" aria-sort={ariaSort(sortKey === "ca", sortDir)}>
                <SortBtn
                  label="CA facturé"
                  active={sortKey === "ca"}
                  dir={sortDir}
                  onClick={() => onToggleSort("ca")}
                />
              </TableHead>
              <TableHead
                className="text-right"
                aria-sort={ariaSort(sortKey === "encaisse", sortDir)}
              >
                <SortBtn
                  label="Encaissé"
                  active={sortKey === "encaisse"}
                  dir={sortDir}
                  onClick={() => onToggleSort("encaisse")}
                />
              </TableHead>
              <TableHead className="text-right" aria-sort={ariaSort(sortKey === "achats", sortDir)}>
                <SortBtn
                  label="Achats"
                  active={sortKey === "achats"}
                  dir={sortDir}
                  onClick={() => onToggleSort("achats")}
                />
              </TableHead>
              <TableHead
                className="text-right"
                aria-sort={ariaSort(sortKey === "resultat", sortDir)}
              >
                <SortBtn
                  label="Résultat brut"
                  active={sortKey === "resultat"}
                  dir={sortDir}
                  onClick={() => onToggleSort("resultat")}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : !hasSelection ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="h-6 w-6" />
                    <p>Aucun exercice sélectionné.</p>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={onSelectAll}
                    >
                      Tout sélectionner
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucune donnée pour les exercices sélectionnés.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={r.exercice_id}>
                  <TableCell className="font-semibold">
                    <Link
                      to="/exercices/rapport"
                      search={{ exercice: r.exercice_id }}
                      className="text-primary hover:underline"
                    >
                      {r.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.nbCommandes}</TableCell>
                  <TableCell className="text-right">{r.nbFactures}</TableCell>
                  <KpiCell exId={r.exercice_id} value={r.ca} evol={evolution(i, "ca")} />
                  <KpiCell
                    exId={r.exercice_id}
                    value={r.encaisse}
                    evol={evolution(i, "encaisse")}
                  />
                  <KpiCell exId={r.exercice_id} value={r.achats} evol={evolution(i, "achats")} />
                  <KpiCell
                    exId={r.exercice_id}
                    value={r.resultat}
                    evol={evolution(i, "resultat")}
                    bold
                  />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
