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
  MoreHorizontal,
  Download,
  Printer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import type { CommandeActionsProps } from "@/components/commandes/CommandeActions";
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

function DocSub({
  label,
  icon: Icon,
  onView,
  onDownload,
  onPrint,
}: {
  label: string;
  icon: LucideIcon;
  onView: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon className="mr-2 h-4 w-4" /> {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onSelect={onView}>
          <Eye className="mr-2 h-4 w-4" /> Aperçu
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download className="mr-2 h-4 w-4" /> Télécharger
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimer
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * Actions compactes d'une ligne (vue tableau) : Visualiser + Valider visibles,
 * le reste regroupé dans un menu « ⋯ ». Mêmes conditions que CommandeActions.
 */
export function CommandeRowMenu({
  commande: c,
  readOnly,
  isSuperAdmin,
  canModifier,
  canValider,
  onValider,
  validerPending,
  onDelete,
}: CommandeActionsProps) {
  const { has, isLoading: permsLoading } = usePermissions();
  const canDelete = !permsLoading && has("commandes.supprimer");
  const hasFactureBL =
    c.statut === "validee" || c.statut === "facturee" || c.statut === "livree";
  const canEdit =
    !readOnly &&
    canModifier &&
    (isSuperAdmin || c.statut === "brouillon" || c.statut === "en_attente_validation");

  return (
    <div className="flex items-center justify-end gap-1">
      <Button aria-label="Visualiser" asChild variant="ghost" size="icon" title="Visualiser">
        <Link to="/commandes/$commandeId" params={{ commandeId: c.commande_id }}>
          <Eye className="h-4 w-4" />
        </Link>
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
          <CheckCircle className="h-4 w-4 text-success" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Plus d'actions" variant="ghost" size="icon" title="Plus d'actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Documents</DropdownMenuLabel>
          <DocSub
            label="Bon de commande"
            icon={ShoppingCart}
            onView={() => viewBonCommande(c)}
            onDownload={() => downloadBonCommande(c)}
            onPrint={() => printBonCommande(c)}
          />
          <DocSub
            label="Proforma"
            icon={FileText}
            onView={() => viewProforma(c)}
            onDownload={() => downloadProforma(c)}
            onPrint={() => printProforma(c)}
          />
          {hasFactureBL && (
            <>
              <DocSub
                label="Facture"
                icon={Receipt}
                onView={() => viewFactureFor(c)}
                onDownload={() => downloadFactureFor(c)}
                onPrint={() => printFactureFor(c)}
              />
              <DocSub
                label="Bon de livraison"
                icon={Truck}
                onView={() => viewBLFor(c)}
                onDownload={() => downloadBLFor(c)}
                onPrint={() => printBLFor(c)}
              />
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => emailCommande(c)}>
            <Mail className="mr-2 h-4 w-4" /> Envoyer par email
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link to="/commandes/$commandeId/modifier" params={{ commandeId: c.commande_id }}>
                <Pencil className="mr-2 h-4 w-4" /> Modifier
              </Link>
            </DropdownMenuItem>
          )}
          {isSuperAdmin && canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(c)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer définitivement
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
