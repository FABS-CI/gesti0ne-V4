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
import type { RecapLine } from "@/lib/paiement-recap";

type Props = {
  lignes: RecapLine[];
  mode: "draft" | "confirm";
};

export function RecapCard({ lignes, mode }: Props) {
  const totalImpute = lignes.reduce((s, l) => s + l.montant_impute, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          4. Récapitulatif {mode === "confirm" ? "(à confirmer)" : "(brouillon)"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facture</TableHead>
              <TableHead className="text-right">Reste avant</TableHead>
              <TableHead className="text-right">Montant imputé</TableHead>
              <TableHead className="text-right">Reste après</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((rec) => (
              <TableRow key={rec.reference}>
                <TableCell className="font-mono text-xs">{rec.reference}</TableCell>
                <TableCell className="text-right">{formatFCFA(rec.reste_avant)}</TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  {formatFCFA(rec.montant_impute)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatFCFA(rec.reste_apres)}
                </TableCell>
              </TableRow>
            ))}
            {lignes.length > 1 && (
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right text-primary">
                  {formatFCFA(totalImpute)}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
