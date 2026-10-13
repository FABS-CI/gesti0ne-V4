import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportXlsx } from "@/lib/rapports-api";
import { formatFCFA } from "@/lib/format";
import { SkeletonTable } from "@/components/ui/skeletons";

export type AgregatRow = {
  label: string;
  qte: number;
  ca: number;
  nb_clients: number;
  nb_factures: number;
  nb_produits: number;
};

export function AgregatCard({
  title,
  data,
  isLoading = false,
}: {
  title: string;
  data: AgregatRow[];
  isLoading?: boolean;
}) {
  if (isLoading) return <SkeletonTable rows={6} cols={6} />;
  const headers = ["Libellé", "Quantité", "CA", "Clients", "Factures", "Produits"];
  const rows = data.map((d) => [d.label, d.qte, d.ca, d.nb_clients, d.nb_factures, d.nb_produits]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => exportXlsx(title, headers, rows)}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { exportListePDF } = await import("@/lib/pdf/exportListe");
              await exportListePDF({
                titre: title,
                colonnes: headers,
                lignes: data.map((d) => [
                  d.label,
                  d.qte,
                  formatFCFA(d.ca),
                  d.nb_clients,
                  d.nb_factures,
                  d.nb_produits,
                ]),
                filename: title,
              });
            }}
          >
            <Download className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h} className={h === "Libellé" ? "" : "text-right"}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                  Aucune vente sur cette période pour les filtres choisis.
                </TableCell>
              </TableRow>
            ) : (
              data.map((d, i) => (
                <TableRow key={i} className="tabular-nums">
                  <TableCell>{d.label}</TableCell>
                  <TableCell className="text-right">{d.qte}</TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(d.ca)}</TableCell>
                  <TableCell className="text-right">{d.nb_clients}</TableCell>
                  <TableCell className="text-right">{d.nb_factures}</TableCell>
                  <TableCell className="text-right">{d.nb_produits}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
