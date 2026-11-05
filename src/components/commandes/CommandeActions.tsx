import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocActionsMenu } from "@/components/commandes/DocActionsMenu";
import { usePermissions } from "@/hooks/use-permissions";
import { aDroitSurCommande, peutModifierCommande, type Commande } from "@/lib/commandes-api";
import {
  viewBonCommande,
  downloadBonCommande,
  printBonCommande,
  viewProforma,
  downloadProforma,
  printProforma,
  viewFactureFor,
  downloadFactureFor,
  printFactureFor,
  viewBLFor,
  downloadBLFor,
  printBLFor,
  emailCommande,
} from "@/lib/commandes-pdf-actions";

export interface CommandeActionsProps {
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
 * Barre d'actions partagée entre la vue table (desktop) et la vue carte (mobile).
 * Garde exactement la même logique conditionnelle : Visualiser, BC, Proforma,
 * Email, Valider (si applicable), Facture/BL (si validée), Modifier, Supprimer.
 */
export function CommandeActions({
  commande: c,
  readOnly,
  isSuperAdmin,
  canModifier,
  canValider,
  onValider,
  validerPending,
  onDelete,
}: CommandeActionsProps) {
  const { has } = usePermissions();
  const hasFactureBL = c.statut === "validee" || c.statut === "facturee" || c.statut === "livree";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button aria-label="Visualiser" asChild variant="ghost" size="sm" title="Visualiser">
        <Link to="/commandes/$commandeId" params={{ commandeId: c.commande_id }}>
          Voir
        </Link>
      </Button>
      <DocActionsMenu
        label="Bon de commande"
        onView={() => viewBonCommande(c)}
        onDownload={() => downloadBonCommande(c)}
        onPrint={() => printBonCommande(c)}
      />
      <DocActionsMenu
        label="Proforma"
        onView={() => viewProforma(c)}
        onDownload={() => downloadProforma(c)}
        onPrint={() => printProforma(c)}
      />
      <Button
        aria-label="Envoyer par email"
        variant="ghost"
        size="sm"
        title="Envoyer par email"
        onClick={() => emailCommande(c)}
      >
        Email
      </Button>

      {c.statut === "en_attente_validation" && canValider && (
        <Button
          aria-label="Valider la commande (génère facture + BL)"
          variant="ghost"
          size="sm"
          title="Valider la commande (génère facture + BL)"
          onClick={() => onValider(c.commande_id)}
          disabled={validerPending}
        >
          Valider
        </Button>
      )}

      {hasFactureBL && (
        <>
          <DocActionsMenu
            label="Facture"
            onView={() => viewFactureFor(c)}
            onDownload={() => downloadFactureFor(c)}
            onPrint={() => printFactureFor(c)}
          />
          <DocActionsMenu
            label="Bon de livraison"
            onView={() => viewBLFor(c)}
            onDownload={() => downloadBLFor(c)}
            onPrint={() => printBLFor(c)}
          />
        </>
      )}

      {!readOnly && peutModifierCommande(c.statut, has) && (
        <Button
          aria-label="Modifier / voir le détail"
          asChild
          variant="ghost"
          size="sm"
          title="Modifier / voir le détail"
        >
          <Link to="/commandes/$commandeId/modifier" params={{ commandeId: c.commande_id }}>
            Modifier
          </Link>
        </Button>
      )}

      {aDroitSurCommande(c.statut, "commandes.supprimer", has) && (
        <Button
          aria-label="Supprimer définitivement"
          variant="ghost"
          size="sm"
          title="Supprimer définitivement"
          onClick={() => onDelete(c)}
        >
          Supprimer
        </Button>
      )}
    </div>
  );
}
