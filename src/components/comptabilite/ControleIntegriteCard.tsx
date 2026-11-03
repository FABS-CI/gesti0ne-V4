import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { usePermissions } from "@/hooks/use-permissions";

// Écriture manuelle : la pièce affichée est l'identifiant de l'écriture.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const qc = useQueryClient();
  const { has } = usePermissions();
  const peutNeutraliser = has("comptabilite.modifier");
  const [aNeutraliser, setANeutraliser] = useState<{ id: string; reference: string } | null>(null);
  const [motif, setMotif] = useState("");

  // Neutralisation (migration 0112) : écriture inverse à la même date, liée à l'originale.
  const neutraliser = useMutation({
    mutationFn: async () => {
      const { error } = await callRpc(
        "compta_neutraliser_ecriture",
        { p_ecriture_id: aNeutraliser!.id, p_motif: motif.trim() },
        { module: "comptabilite", recordId: aNeutraliser!.id },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        `Écriture ${aNeutraliser?.reference ?? ""} neutralisée : ressaisissez-la correctement.`,
      );
      setANeutraliser(null);
      setMotif("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

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
          en lecture seule : rien n'est modifié. Une écriture manuelle déséquilibrée se corrige en
          la neutralisant (écriture inverse tracée), puis en la ressaisissant.
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
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Contrôle en cours…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-success">
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
                      <TableCell>
                        {peutNeutraliser &&
                          r.domaine === "Comptabilité" &&
                          UUID.test(r.piece ?? "") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setMotif("");
                                setANeutraliser({ id: r.piece!, reference: r.reference ?? "" });
                              }}
                            >
                              Neutraliser
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </CardContent>

      <Dialog open={!!aNeutraliser} onOpenChange={(o) => !o && setANeutraliser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neutraliser l&apos;écriture {aNeutraliser?.reference}</DialogTitle>
            <DialogDescription>
              Une écriture inverse est passée à la même date et liée à l&apos;originale : la paire
              s&apos;annule dans la balance et reste consultable. Rien n&apos;est supprimé.
              Ressaisissez ensuite l&apos;écriture correcte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motif-neutralisation">Motif (obligatoire)</Label>
            <Textarea
              id="motif-neutralisation"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setANeutraliser(null)}>
              Annuler
            </Button>
            <Button
              disabled={neutraliser.isPending || motif.trim().length < 5}
              onClick={() => neutraliser.mutate()}
            >
              {neutraliser.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Neutraliser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
