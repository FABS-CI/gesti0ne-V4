import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";

export type FactureImpayeeRow = {
  facture_id: string;
  reference: string;
  date_facture: string | null;
  montant_total: number | string;
  montant_paye: number | string;
  solde: number | string;
  statut: string;
};

type Props = {
  clientNom: string;
  factures: FactureImpayeeRow[];
  loading: boolean;
  /** facture_id -> montant affecté */
  selected: Record<string, number>;
  onToggle: (f: FactureImpayeeRow, checked: boolean) => void;
  onMontantChange: (factureId: string, montant: number) => void;
};

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

export function FacturesImpayeesCard({
  clientNom,
  factures,
  loading,
  selected,
  onToggle,
  onMontantChange,
}: Props) {
  const soldeTotal = factures.reduce((s, f) => s + Number(f.solde), 0);
  const totalAffecte = Object.values(selected).reduce((s, m) => s + (Number(m) || 0), 0);
  const nbSelected = Object.keys(selected).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>2. Factures du client {clientNom}</span>
          <span className="text-sm font-normal text-muted-foreground">
            Solde total dû :{" "}
            <span className="font-semibold text-red-600">{formatFCFA(soldeTotal)}</span>
            {nbSelected > 0 && (
              <>
                {" — "}Total affecté :{" "}
                <span className="font-semibold text-primary">{formatFCFA(totalAffecte)}</span>
              </>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground">
          Cochez une ou plusieurs factures, puis ajustez si besoin le montant affecté à chacune.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead className="text-right">Montant affecté</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : factures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  Aucune facture impayée pour ce client
                </TableCell>
              </TableRow>
            ) : (
              factures.map((f) => {
                const checked = f.facture_id in selected;
                return (
                  <TableRow key={f.facture_id} className={checked ? "bg-primary/10" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner la facture ${f.reference}`}
                        checked={checked}
                        onChange={(e) => onToggle(f, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.reference}</TableCell>
                    <TableCell>{frDate(f.date_facture)}</TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(Number(f.montant_total))}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatFCFA(Number(f.montant_paye))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatFCFA(Number(f.solde))}
                    </TableCell>
                    <TableCell className="text-right">
                      {checked ? (
                        <Input
                          type="number"
                          min={0}
                          max={Number(f.solde)}
                          className="ml-auto w-32 text-right"
                          value={selected[f.facture_id]}
                          onChange={(e) =>
                            onMontantChange(f.facture_id, Number(e.target.value) || 0)
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {f.statut === "partielle" ? "Partielle" : "Impayée"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
