import { formatDocumentReference } from "@/lib/document-reference";
import React from "react";
import { ClientLink } from "@/components/common/ClientLink";
import { Badge } from "@/components/ui/badge";
import { STATUT_LABEL, type Commande } from "@/lib/commandes-api";
import { formatFCFA, formatDate } from "@/lib/format";
import { CommandeActions } from "@/components/commandes/CommandeActions";

interface CommandeCardProps {
  commande: Commande;
  readOnly: boolean;
  isSuperAdmin: boolean;
  canModifier: boolean;
  canValider: boolean;
  onValider: (id: string) => void;
  validerPending: boolean;
  onDelete: (c: Commande) => void;
}

/**
 * Vue carte mobile d'une commande : reprend les champs de la ligne de table
 * (référence, client, date, statut, total) et la même barre d'actions.
 * Rendue à la place de <CommandeRow> sur les écrans <md.
 */
function CommandeCardInner({
  commande: c,
  readOnly,
  isSuperAdmin,
  canModifier,
  canValider,
  onValider,
  validerPending,
  onDelete,
}: CommandeCardProps) {
  const st = STATUT_LABEL[c.statut];
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{formatDocumentReference(c.reference)}</span>
            <Badge
              variant="outline"
              className="shrink-0 border-transparent text-[10px] font-medium"
              style={{ background: `${st?.color}1a`, color: st?.color }}
            >
              {st?.label ?? c.statut}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-foreground">
            <ClientLink clientId={c.client_id} nom={c.client_nom} />
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(c.date_commande)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">{formatFCFA(c.montant_total)}</p>
        </div>
      </div>
      <div className="mt-2 border-t pt-2">
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
      </div>
    </div>
  );
}

export const CommandeCard = React.memo(CommandeCardInner);