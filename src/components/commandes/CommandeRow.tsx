import { formatDocumentReference } from "@/lib/document-reference";
import React from "react";
import { Link } from "@tanstack/react-router";
import { ClientLink } from "@/components/common/ClientLink";
import { TableCell, TableRow } from "@/components/ui/table";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import { Badge } from "@/components/ui/badge";
import { STATUT_LABEL, type Commande } from "@/lib/commandes-api";
import { formatFCFA, formatDate } from "@/lib/format";
import { CommandeActions } from "@/components/commandes/CommandeActions";

interface CommandeRowProps {
  commande: Commande;
  readOnly: boolean;
  isSuperAdmin: boolean;
  canModifier: boolean;
  canValider: boolean;
  onValider: (id: string) => void;
  validerPending: boolean;
  onDelete: (c: Commande) => void;
}

function CommandeRowInner({
  commande: c,
  readOnly,
  isSuperAdmin,
  canModifier,
  canValider,
  onValider,
  validerPending,
  onDelete,
}: CommandeRowProps) {
  const st = STATUT_LABEL[c.statut];
  return (
    <TableRow className="group transition-colors odd:bg-muted/20 hover:bg-primary/5">
      <TableCell className="font-semibold">
        <div className="flex items-center gap-2">
          {/* Commande n'a pas de cover_path direct, mais on pourrait enrichir si besoin */}
          <ProductCoverThumb produit={null} size="xs" />
          <Link
            to="/commandes/$commandeId"
            params={{ commandeId: c.commande_id }}
            className="hover:text-primary hover:underline"
          >
            {formatDocumentReference(c.reference)}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <ClientLink clientId={c.client_id} nom={c.client_nom} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(c.date_commande)}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="border-transparent font-medium"
          style={{ background: `${st?.color}1a`, color: st?.color }}
        >
          {st?.label ?? c.statut}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-medium">{formatFCFA(c.montant_total)}</TableCell>
      <TableCell className="text-right">
        <CommandeActions
          commande={c}
          readOnly={readOnly}
          isSuperAdmin={isSuperAdmin}
          canModifier={canModifier}
          canValider={canValider}
          onValider={onValider}
          validerPending={validerPending}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

export const CommandeRow = React.memo(CommandeRowInner);
