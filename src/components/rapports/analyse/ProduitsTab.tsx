import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportXlsx, type ProduitLigneRapport, type RapportFilters } from "@/lib/rapports-api";
import { SkeletonTable } from "@/components/ui/skeletons";
import { formatFCFA } from "@/lib/format";
import {
  PRODUITS_COLUMNS,
  PRODUITS_HEADERS,
  produitsRowsForExport,
  fetchAllProduitsRapport,
} from "@/lib/rapports-analyse-helpers";

type Props = {
  rows: ProduitLigneRapport[];
  total: number;
  isLoading: boolean;
  tri: string;
  sens: "asc" | "desc";
  onSort: (key: string) => void;
  page: number;
  onPage: (page: number) => void;
  filters: RapportFilters;
};

const fmtN = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");

export function ProduitsTab({
  rows,
  total,
  isLoading,
  tri,
  sens,
  onSort,
  page,
  onPage,
  filters,
}: Props) {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const runExport = async (kind: "xlsx" | "pdf") => {
    setProgress({ loaded: 0, total });
    try {
      const all = await fetchAllProduitsRapport(filters, tri, sens, (loaded, t) =>
        setProgress({ loaded, total: t }),
      );
      if (kind === "xlsx") {
        await exportXlsx("rapport_produits", PRODUITS_HEADERS, produitsRowsForExport(all));
      } else {
        const { exportRapportProduitsPdf } = await import("@/lib/pdf/rapport-produits-pdf");
        await exportRapportProduitsPdf(all);
      }
      toast.success(`${fmtN(all.length)} lignes exportées`);
    } catch {
      toast.error("L'export n'a pas pu être réalisé. Réessayez ou contactez l'administrateur.");
    } finally {
      setProgress(null);
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Rapport détaillé produits</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!!progress || total === 0}
            onClick={() => runExport("xlsx")}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!progress || total === 0}
            onClick={() => runExport("pdf")}
          >
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          {progress && (
            <span className="self-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {fmtN(progress.loaded)} / {fmtN(progress.total)} lignes
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {PRODUITS_COLUMNS.map(([key, label]) => (
                  <TableHead
                    key={label}
                    className={key ? "cursor-pointer select-none" : ""}
                    onClick={() => key && onSort(key)}
                  >
                    {label}
                    {key && tri === key ? (sens === "asc" ? " ↑" : " ↓") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={19} className="p-3">
                    <SkeletonTable rows={8} cols={8} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={19} className="py-6 text-center text-muted-foreground">
                    Aucune vente sur cette période pour les filtres choisis.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.produit_id} className="tabular-nums">
                    <TableCell className="font-mono text-xs">{r.code ?? "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.titre}</TableCell>
                    <TableCell>
                      {r.niveau ? <Badge variant="outline">{r.niveau}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{r.categorie ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatFCFA(r.prix_unitaire)}</TableCell>
                    <TableCell className="text-right font-medium">{r.qte_vendue}</TableCell>
                    <TableCell className="text-right">{r.qte_facturee}</TableCell>
                    <TableCell className="text-right">{r.nb_factures}</TableCell>
                    <TableCell className="text-right">{r.nb_clients}</TableCell>
                    <TableCell className="text-right font-medium">{formatFCFA(r.ca)}</TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {formatFCFA(r.ca_encaisse ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(r.reste_a_encaisser ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">{formatFCFA(r.remises)}</TableCell>
                    <TableCell className="text-right">{r.qte_retournee}</TableCell>
                    <TableCell className="text-right">{r.stock_actuel}</TableCell>
                    <TableCell className="text-right">{r.stock_initial}</TableCell>
                    <TableCell className="text-right">{r.stock_restant}</TableCell>
                    <TableCell className="text-right">{r.pct_ca}%</TableCell>
                    <TableCell className="text-right">
                      <Badge>{r.rang}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span className="text-muted-foreground">{fmtN(total)} produits</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Précédent
            </Button>
            <span className="self-center">Page {page}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page * 50 >= total}
              onClick={() => onPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
