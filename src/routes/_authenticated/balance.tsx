import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Scale } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { getBalance } from "@/lib/compta-api";
import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { generateBalancePDF } from "@/lib/pdf/pdfGenerator";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/balance")({
  component: BalancePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function BalancePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["balance", from, to],
    queryFn: () => getBalance(from || undefined, to || undefined),
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.debit += r.debit;
      acc.credit += r.credit;
      return acc;
    },
    { debit: 0, credit: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Scale className="h-6 w-6" /> Balance générale
          </h1>
          <p className="text-sm text-muted-foreground">Cumul débit/crédit par compte</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                "balance",
                ["Compte", "Libellé", "Débit", "Crédit", "Solde"],
                rows.map((r) => [r.compte, r.compte_libelle, r.debit, r.credit, r.solde]),
                {
                  pageTitle: "BALANCE GÉNÉRALE",
                  summary: [
                    { label: "Nombre de comptes", value: String(rows.length) },
                    { label: "Total débit", value: formatFCFA(totals.debit) },
                    {
                      label: "Total crédit",
                      value: formatFCFA(totals.credit),
                    },
                    {
                      label: "Solde net",
                      value: formatFCFA((totals.debit - totals.credit)),
                    },
                  ],
                },
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            onClick={() =>
              generateBalancePDF(rows, { dateFrom: from || undefined, dateTo: to || undefined })
            }
            disabled={!rows.length}
          >
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div>
            <Label>Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucune écriture sur la période
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((r) => (
                      <TableRow key={r.compte}>
                        <TableCell className="font-mono">{r.compte}</TableCell>
                        <TableCell>{r.compte_libelle}</TableCell>
                        <TableCell className="text-right">{formatFCFA(r.debit)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(r.credit)}</TableCell>
                        <TableCell
                          className="text-right font-medium"
                          style={{ color: r.solde >= 0 ? "#10B981" : "#EF4444" }}
                        >
                          {formatFCFA(r.solde)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right">{formatFCFA(totals.debit)}</TableCell>
                      <TableCell className="text-right">{formatFCFA(totals.credit)}</TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(totals.debit - totals.credit)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </div>
  );
}
