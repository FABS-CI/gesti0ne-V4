import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import type { SoldeDebug } from "@/lib/pdf/etat-compte-solde";
import type { EtatCompteClient } from "@/hooks/use-etat-compte-clients";

type Props = {
  clients: EtatCompteClient[];
  debugByClient: Map<string, SoldeDebug>;
  dateDebut: string | null;
  dateFin: string | null;
};

export function EtatCompteDebugPanel({ clients, debugByClient, dateDebut, dateFin }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4 text-xs">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          Panneau debug — calculs partagés tableau ↔ PDF
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Filtres statut :</span> paiements=
            <code>valide</code>, avoirs=<code>valide</code>
          </div>
          <div>
            <span className="text-muted-foreground">Période exercice :</span>{" "}
            <code>{dateDebut ?? "—"}</code> → <code>{dateFin ?? "—"}</code>
          </div>
        </div>
        <div className="max-h-80 overflow-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Ouverture (row)</TableHead>
                <TableHead className="text-right">Report antérieur</TableHead>
                <TableHead className="text-right">Ouverture totale</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="text-right">F / P / A</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => {
                const d = debugByClient.get(c.client_id);
                if (!d) return null;
                return (
                  <TableRow key={c.client_id}>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell className="text-right">{formatFCFA(d.soldeOuvertureRow)}</TableCell>
                    <TableCell className="text-right">{formatFCFA(d.reportAnterieur)}</TableCell>
                    <TableCell className="text-right">{formatFCFA(d.soldeOuverture)}</TableCell>
                    <TableCell className="text-right">{formatFCFA(d.totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatFCFA(d.totalCredit)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatFCFA(d.solde)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {d.compteurs.facturesRetenues}/{d.compteurs.facturesBrutes} ·{" "}
                      {d.compteurs.paiementsValidesPeriode}/{d.compteurs.paiementsBruts} ·{" "}
                      {d.compteurs.avoirsValidesPeriode}/{d.compteurs.avoirsBruts}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground">
          Solde = Ouverture totale + Débit − Crédit. « F/P/A » = mouvements retenus / bruts
          (factures, paiements valides période, avoirs valides période).
        </p>
      </CardContent>
    </Card>
  );
}
