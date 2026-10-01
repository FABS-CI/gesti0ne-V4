import { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/components/rbac/Can";
import { formatFCFA, formatDate } from "@/lib/format";
import { MODE_PAIEMENT_LABEL } from "@/lib/paiements-api";
import {
  usePaiementsEnAttente,
  useRejeterPaiement,
  useValiderPaiement,
} from "@/lib/paiements-validation";
import { RejeterPaiementDialog } from "./RejeterPaiementDialog";

export function PaiementsEnAttenteCard({ exerciceId }: { exerciceId?: string | null }) {
  const { data: paiements = [], isLoading } = usePaiementsEnAttente(exerciceId);
  const valider = useValiderPaiement();
  const rejeter = useRejeterPaiement();
  const [toReject, setToReject] = useState<{ id: string; reference: string } | null>(null);

  return (
    <Can permission="paiements.valider">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Paiements en attente de validation
          </CardTitle>
          <Badge variant="outline">{paiements.length}</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : paiements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun paiement en attente. Tout est à jour.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paiements.map((p) => (
                  <TableRow key={p.paiement_id}>
                    <TableCell className="font-medium">{p.reference}</TableCell>
                    <TableCell>{formatDate(p.date_paiement)}</TableCell>
                    <TableCell>{p.client_nom ?? "—"}</TableCell>
                    <TableCell>{MODE_PAIEMENT_LABEL[p.mode_paiement] ?? p.mode_paiement}</TableCell>
                    <TableCell className="text-right font-medium">{formatFCFA(Number(p.montant))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => valider.mutate({ id: p.paiement_id })}
                        disabled={valider.isPending}
                        title="Valider"
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setToReject({ id: p.paiement_id, reference: p.reference })}
                        disabled={rejeter.isPending}
                        title="Rejeter"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RejeterPaiementDialog
        open={!!toReject}
        onOpenChange={(v) => !v && setToReject(null)}
        reference={toReject?.reference}
        pending={rejeter.isPending}
        onConfirm={(motif) => {
          if (!toReject) return;
          rejeter.mutate(
            { id: toReject.id, motif },
            { onSuccess: () => setToReject(null) },
          );
        }}
      />
    </Can>
  );
}