import { useQuery } from "@tanstack/react-query";

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

type Doublon = {
  client_id: string;
  client_nom: string | null;
  exercice_id: string;
  exercice: string | null;
  montant: number;
  factures_anterieures: number;
  montant_factures_anterieures: number;
};

/**
 * Soldes d'ouverture clients qui font peut-être double emploi (RPC
 * compta_soldes_ouverture_doublons, migration 0112) : l'état de compte reprend déjà les
 * factures antérieures à l'exercice. Lecture seule ; la correction est une décision humaine.
 */
export function SoldesOuvertureDoublonsCard() {
  const q = useQuery({
    queryKey: ["soldes-ouverture-doublons"],
    queryFn: async () => {
      const { data, error } = await callRpc(
        "compta_soldes_ouverture_doublons",
        {},
        { module: "audit" },
      );
      if (error) throw error;
      return (data ?? []) as Doublon[];
    },
  });
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Soldes d&apos;ouverture clients à vérifier {q.data ? `(${rows.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          L&apos;état de compte client additionne le solde d&apos;ouverture et toutes les factures
          antérieures à l&apos;exercice. Jusqu&apos;à la migration 0112, la clôture copiait les
          impayés dans ces soldes : ils sont alors comptés deux fois. Un solde issu d&apos;une vraie
          reprise d&apos;avant l&apos;ERP est, lui, légitime. Rien n&apos;est modifié ici.
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
                  <TableHead>Client</TableHead>
                  <TableHead>Exercice</TableHead>
                  <TableHead className="text-right">Solde d&apos;ouverture</TableHead>
                  <TableHead className="text-right">Factures antérieures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Contrôle en cours…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-success">
                      Aucun solde d&apos;ouverture en double.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={`${r.client_id}-${r.exercice_id}`}>
                      <TableCell className="font-medium">{r.client_nom ?? "—"}</TableCell>
                      <TableCell>{r.exercice ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatFCFA(r.montant)}</TableCell>
                      <TableCell className="text-right">
                        {r.factures_anterieures} — {formatFCFA(r.montant_factures_anterieures)}
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
