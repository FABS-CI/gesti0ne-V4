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
import type { EngineResult } from "@/lib/paie/engine";

export function RubriquesCard({ result }: { result: EngineResult | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Détail des rubriques</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">Taux</TableHead>
              <TableHead className="text-right">Gain</TableHead>
              <TableHead className="text-right">Retenue</TableHead>
              <TableHead className="text-right">Patronal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result?.lignes.map((l, i) => (
              <TableRow key={`${l.code}-${i}`}>
                <TableCell className="font-mono text-xs">{l.code}</TableCell>
                <TableCell>{l.libelle}</TableCell>
                <TableCell className="text-right">{l.base ? formatFCFA(l.base) : "—"}</TableCell>
                <TableCell className="text-right">{l.taux ? `${l.taux}%` : "—"}</TableCell>
                <TableCell className="text-right text-success">
                  {l.gain ? formatFCFA(l.gain) : "—"}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {l.retenue ? formatFCFA(l.retenue) : "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {l.patronale ? formatFCFA(l.patronale) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
