import { Link } from "@tanstack/react-router";
import {
  Eye,
  Pencil,
  Trash2,
  ShoppingCart,
  FileText,
  Truck,
  Mail,
  CheckCircle,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocActionsMenu } from "@/components/commandes/DocActionsMenu";
import { Can } from "@/components/rbac/Can";
import type { Commande } from "@/lib/commandes-api";
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
  const hasFactureBL =
    c.statut === "validee" || c.statut === "facturee" || c.statut === "livree";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button aria-label="Visualiser" asChild variant="ghost" size="icon" title="Visualiser">
        <Link to="/commandes/$commandeId" params={{ commandeId: c.commande_id }}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>

      <DocActionsMenu
        label="Bon de commande"
        icon={ShoppingCart}
        onView={() => viewBonCommande(c)}
        onDownload={() => downloadBonCommande(c)}
        onPrint={() => printBonCommande(c)}
      />

      <DocActionsMenu
        label="Proforma"
        icon={FileText}
        onView={() => viewProforma(c)}
        onDownload={() => downloadProforma(c)}
        onPrint={() => printProforma(c)}
      />

      <Button
        aria-label="Envoyer par email"
        variant="ghost"
        size="icon"
        title="Envoyer par email"
        onClick={() => emailCommande(c)}
      >
        <Mail className="h-4 w-4" />
      </Button>

      {c.statut === "en_attente_validation" && canValider && (
        <Button
          aria-label="Valider la commande (génère facture + BL)"
          variant="ghost"
          size="icon"
          title="Valider la commande (génère facture + BL)"
          onClick={() => onValider(c.commande_id)}
          disabled={validerPending}
        >
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        </Button>
      )}

      {hasFactureBL && (
        <>
          <DocActionsMenu
            label="Facture"
            icon={Receipt}
            onView={() => viewFactureFor(c)}
            onDownload={() => downloadFactureFor(c)}
            onPrint={() => printFactureFor(c)}
          />
          <DocActionsMenu
            label="Bon de livraison"
            icon={Truck}
            onView={() => viewBLFor(c)}
            onDownload={() => downloadBLFor(c)}
            onPrint={() => printBLFor(c)}
          />
        </>
      )}

      {!readOnly &&
        canModifier &&
        (isSuperAdmin ||
          c.statut === "brouillon" ||
          c.statut === "en_attente_validation") && (
          <Button
            aria-label="Modifier / voir le détail"
            asChild
            variant="ghost"
            size="icon"
            title="Modifier / voir le détail"
          >
            <Link to="/commandes/$commandeId/modifier" params={{ commandeId: c.commande_id }}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
        )}

      {isSuperAdmin && (
        <Can permission="commandes.supprimer">
          <Button
            aria-label="Supprimer définitivement (Super Admin)"
            variant="ghost"
            size="icon"
            title="Supprimer définitivement (Super Admin)"
            onClick={() => onDelete(c)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </Can>
      )}
    </div>
  );
}