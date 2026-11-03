import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBalanceExercice, type BalanceExerciceRow } from "@/lib/compta-api";
import { formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

const COLONNES = [
  "ouvertureDebit",
  "ouvertureCredit",
  "mouvementDebit",
  "mouvementCredit",
  "soldeDebit",
  "soldeCredit",
] as const satisfies readonly (keyof BalanceExerciceRow)[];

/**
 * Balance d'un exercice à six colonnes : à-nouveaux (soldes cumulés des classes 1 à 5 à
 * la veille de l'exercice, résultats antérieurs au report à nouveau), mouvements de
 * l'exercice, soldes de clôture. Calculée par compta_balance_exercice (migration 0112).
 */
export function BalanceExerciceTable({ exerciceId }: { exerciceId: string }) {
  const q = useQuery({
    queryKey: ["balance-exercice", exerciceId],
    queryFn: () => getBalanceExercice(exerciceId),
  });
  const rows = q.data ?? [];
  const totaux = Object.fromEntries(
    COLONNES.map((c) => [c, rows.reduce((s, r) => s + r[c], 0)]),
  ) as Record<(typeof COLONNES)[number], number>;
  const equilibree = COLONNES.every(
    (c, i) => i % 2 === 1 || Math.abs(totaux[c] - totaux[COLONNES[i + 1]]) < 0.01,
  );

  return (
    <Card>
      <CardContent className="p-0">
        {q.error ? (
          <p className="p-4 text-sm text-destructive">
            {friendlyError(q.error, "Balance indisponible")}
          </p>
        ) : (
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Compte</TableHead>
                  <TableHead rowSpan={2}>Libellé</TableHead>
                  <TableHead colSpan={2} className="text-center">
                    À-nouveaux
                  </TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Mouvements
                  </TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Soldes de clôture
                  </TableHead>
                </TableRow>
                <TableRow>
                  {COLONNES.map((c, i) => (
                    <TableHead key={c} className="text-right">
                      {i % 2 === 0 ? "Débit" : "Crédit"}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Aucune écriture pour cet exercice
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((r) => (
                      <TableRow key={r.compte} className={r.calcule ? "italic" : undefined}>
                        <TableCell className="font-mono">{r.compte}</TableCell>
                        <TableCell>{r.compte_libelle}</TableCell>
                        {COLONNES.map((c) => (
                          <TableCell key={c} className="text-right">
                            {r[c] ? formatFCFA(r[c]) : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>
                        TOTAL {equilibree ? "" : "— déséquilibre à examiner (Audit comptable)"}
                      </TableCell>
                      {COLONNES.map((c) => (
                        <TableCell key={c} className="text-right">
                          {formatFCFA(totaux[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </CardContent>
    </Card>
  );
}
