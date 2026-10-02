import { formatDocumentReference } from "@/lib/document-reference";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow } from "./shared";
import { frDate } from "@/lib/client-detail-helpers";
import { formatFCFA } from "@/lib/format";
import type { ClientRelations } from "@/lib/clients-api";
import { useNavigate } from "@tanstack/react-router";

type Commande = ClientRelations["commandes"][number];

const CommandeRow = React.memo(function CommandeRow({ c }: { c: Commande }) {
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: "/commandes/$commandeId", params: { commandeId: c.commande_id } })}
    >
      <TableCell className="font-mono text-xs">{formatDocumentReference(c.reference)}</TableCell>
      <TableCell>{frDate(c.date_commande)}</TableCell>
      <TableCell>
        <Badge variant="secondary">{c.statut}</Badge>
      </TableCell>
      <TableCell className="text-right">{formatFCFA(c.montant_total)}</TableCell>
    </TableRow>
  );
});

export function ClientCommandesTab({ commandes }: { commandes: ClientRelations["commandes"] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!commandes.length ? (
            <EmptyRow cols={4} label="Aucune commande" />
          ) : (
            commandes.map((c) => <CommandeRow key={c.commande_id} c={c} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
