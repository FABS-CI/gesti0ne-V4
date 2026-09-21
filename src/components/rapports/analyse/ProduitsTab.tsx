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
import { exportXlsx, type ProduitLigneRapport } from "@/lib/rapports-api";
import { formatFCFA } from "@/lib/format";
import {
  PRODUITS_COLUMNS,
  PRODUITS_HEADERS,
  produitsRowsForExport,
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
};

export function ProduitsTab({ rows, total, isLoading, tri, sens, onSort, page, onPage }: Props) {
  const doExport = () => produitsRowsForExport(rows);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Rapport détaillé produits</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportXlsx("rapport_produits", PRODUITS_HEADERS, doExport())}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { exportRapportProduitsPdf } = await import("@/lib/pdf/rapport-produits-pdf");
              await exportRapportProduitsPdf(rows);
            }}
          >
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
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
                  <TableCell colSpan={17} className="py-6 text-center">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="py-6 text-center text-muted-foreground">
                    Aucune donnée
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.produit_id}>
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
                    <TableCell className="text-right font-medium text-emerald-600">
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
          <span className="text-muted-foreground">{total} produits</span>
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
