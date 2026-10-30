import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { callRpc } from "@/lib/rpc";

type Anomalie = {
  domaine: string;
  anomalie: string;
  piece: string | null;
  reference: string | null;
  montant_piece: number | null;
  montant_ecritures: number | null;
};

/**
 * Rapprochement pièces de gestion ↔ écritures (Finances, Comptabilité, Paie) :
 * RPC controle_integrite_global (migration 0111), en lecture seule. Les corrections se
 * font sur la pièce (annulation, contre-passation), jamais automatiquement.
 */
export function ControleIntegriteCard() {
  const q = useQuery({
    queryKey: ["controle-integrite-global"],
    queryFn: async () => {
      const { data, error } = await callRpc("controle_integrite_global", {}, { module: "audit" });
      if (error) throw error;
      return (data ?? []) as Anomalie[];
    },
  });
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Rapprochement pièces ↔ écritures {q.data ? `(${rows.length})` : ""}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} />
          Relancer
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Factures, paiements, achats et bulletins de paie comparés à leurs écritures comptables,
          écritures déséquilibrées et transactions « salaire » à rapprocher des bulletins. Contrôle
          en lecture seule : rien n'est modifié.
        </p>
        {q.error ? (
          <p className="text-sm text-destructive">
            {friendlyError(q.error, "Contrôle indisponible")}
          </p>
        ) : (
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domaine</TableHead>
                  <TableHead>Anomalie</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Montant pièce</TableHead>
                  <TableHead className="text-right">Montant écritures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Contrôle en cours…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-success">
                      Aucun écart entre les pièces et les écritures.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.piece ?? ""}-${r.anomalie}-${i}`}>
                      <TableCell>
                        <Badge variant="outline">{r.domaine}</Badge>
                      </TableCell>
                      <TableCell>{r.anomalie}</TableCell>
                      <TableCell className="font-medium">{r.reference ?? r.piece ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.montant_piece == null ? "—" : formatFCFA(r.montant_piece)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.montant_ecritures == null ? "—" : formatFCFA(r.montant_ecritures)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </CardContent>
    </Card>
  );
}
