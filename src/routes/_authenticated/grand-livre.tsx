import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText, FileDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { getLignesPeriode } from "@/lib/compta-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { generateGrandLivrePDF } from "@/lib/pdf/pdfGenerator";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/grand-livre")({
  component: GrandLivrePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function GrandLivrePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [compte, setCompte] = useState<string>("all");

  const { data: lignes = [], isLoading } = useQuery({
    queryKey: ["grand-livre", from, to],
    queryFn: () => getLignesPeriode(from || undefined, to || undefined),
  });

  const comptes = useMemo(() => {
    const set = new Map<string, string>();
    for (const l of lignes) set.set(l.compte, l.compte_libelle);
    return Array.from(set.entries())
      .map(([compte, lib]) => ({ compte, lib }))
      .sort((a, b) => a.compte.localeCompare(b.compte));
  }, [lignes]);

  const filtered = useMemo(() => {
    const list = (compte === "all" ? lignes : lignes.filter((l) => l.compte === compte))
      .slice()
      .sort((a, b) => {
        if (a.compte !== b.compte) return a.compte.localeCompare(b.compte);
        return a.date_ecriture.localeCompare(b.date_ecriture);
      });
    // calcul solde progressif par compte
    let lastCompte = "";
    let solde = 0;
    return list.map((l) => {
      if (l.compte !== lastCompte) {
        solde = 0;
        lastCompte = l.compte;
      }
      solde += l.debit - l.credit;
      return { ...l, solde };
    });
  }, [lignes, compte]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <FileText className="h-6 w-6" /> Grand livre
          </h1>
          <p className="text-sm text-muted-foreground">Détail des écritures par compte</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                "grand-livre",
                [
                  "Compte",
                  "Libellé compte",
                  "Date",
                  "Journal",
                  "Réf.",
                  "Libellé",
                  "Débit",
                  "Crédit",
                  "Solde",
                ],
                filtered.map((l) => [
                  l.compte,
                  l.compte_libelle,
                  l.date_ecriture,
                  l.journal,
                  l.reference,
                  l.libelle,
                  l.debit,
                  l.credit,
                  l.solde,
                ]),
                {
                  pageTitle: "GRAND LIVRE",
                  summary: (() => {
                    const td = filtered.reduce((s, l) => s + Number(l.debit || 0), 0);
                    const tc = filtered.reduce((s, l) => s + Number(l.credit || 0), 0);
                    return [
                      { label: "Nombre d'écritures", value: String(filtered.length) },
                      {
                        label: "Comptes distincts",
                        value: String(new Set(filtered.map((l) => l.compte)).size),
                      },
                      { label: "Total débit", value: formatFCFA(td) },
                      { label: "Total crédit", value: formatFCFA(tc) },
                      { label: "Solde", value: formatFCFA((td - tc)) },
                    ];
                  })(),
                },
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            onClick={() =>
              generateGrandLivrePDF(filtered, {
                dateFrom: from || undefined,
                dateTo: to || undefined,
                compte,
              })
            }
            disabled={!filtered.length}
          >
            <FileDown className="mr-2 h-4 w-4" /> PDF
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
          <div className="min-w-[240px]">
            <Label>Compte</Label>
            <Select value={compte} onValueChange={setCompte}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                {comptes.map((c) => (
                  <SelectItem key={c.compte} value={c.compte}>
                    {c.compte} — {c.lib}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Aucune ligne
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.ligne_id}>
                      <TableCell className="font-mono text-xs">{l.compte}</TableCell>
                      <TableCell>
                        {l.date_ecriture
                          ? formatDate(l.date_ecriture)
                          : "—"}
                      </TableCell>
                      <TableCell>{l.journal}</TableCell>
                      <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{l.libelle}</TableCell>
                      <TableCell className="text-right">
                        {l.debit ? formatFCFA(l.debit) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.credit ? formatFCFA(l.credit) : "—"}
                      </TableCell>
                      <TableCell
                        className="text-right font-medium"
                        style={{ color: l.solde >= 0 ? "#10B981" : "#EF4444" }}
                      >
                        {formatFCFA(l.solde)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </div>
  );
}
