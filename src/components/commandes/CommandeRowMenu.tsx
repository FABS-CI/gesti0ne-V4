import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SolderFactureDialog, loadFactureSolde } from "@/components/commandes/SolderFactureDialog";
import {
  Eye,
  Pencil,
  Trash2,
  ShoppingCart,
  FileText,
  Truck,
  Wallet,
  Loader2,
  CheckCircle,
  Receipt,
  MoreHorizontal,
  Download,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  viewProforma,
  downloadProforma,
  viewFactureFor,
  downloadFactureFor,
  viewBLFor,
  downloadBLFor,
} from "@/lib/commandes-pdf-actions";

function DocSub({
  label,
  icon: Icon,
  onView,
  onDownload,
}: {
  label: string;
  icon: LucideIcon;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon className="mr-2 h-4 w-4" /> {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onSelect={onView}>
          <Eye className="mr-2 h-4 w-4" /> Visualiser
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download className="mr-2 h-4 w-4" /> Télécharger
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DocPending({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <DropdownMenuItem disabled>
      <Icon className="mr-2 h-4 w-4" /> {label} — pas encore générée
    </DropdownMenuItem>
  );
}

/**
 * Actions d'une ligne : Valider (si en attente), menu « Documents »
 * (Visualiser / Télécharger) et menu « ⋯ » (paiement, modification, suppression).
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
  const canPayer = !permsLoading && has("paiements.creer");
  const hasFactureBL =
    c.statut === "validee" || c.statut === "facturee" || c.statut === "livree";
  const canEdit =
    !readOnly &&
    canModifier &&
    (isSuperAdmin || c.statut === "brouillon" || c.statut === "en_attente_validation");
  const [moreOpen, setMoreOpen] = useState(false);
  const [solderOpen, setSolderOpen] = useState(false);
  const { data: solde, isLoading: soldeLoading } = useQuery({
    queryKey: ["facture-solde", c.commande_id],
    queryFn: () => loadFactureSolde(c.commande_id),
    enabled: moreOpen && hasFactureBL && canPayer,
  });
  const showSolder = hasFactureBL && canPayer && !!solde && solde.statut !== "PAYÉE";

  return (
    <div className="flex items-center justify-end gap-1">
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
          <Button variant="outline" size="sm" className="h-8 px-2">
            <FileText className="mr-1 h-4 w-4" /> Documents
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DocSub
            label="Proforma"
            icon={FileText}
            onView={() => viewProforma(c)}
            onDownload={() => downloadProforma(c)}
          />
          <DocSub
            label="Bon de commande"
            icon={ShoppingCart}
            onView={() => viewBonCommande(c)}
            onDownload={() => downloadBonCommande(c)}
          />
          {hasFactureBL ? (
            <>
              <DocSub
                label="Facture"
                icon={Receipt}
                onView={() => viewFactureFor(c)}
                onDownload={() => downloadFactureFor(c)}
              />
              <DocSub
                label="Bon de livraison"
                icon={Truck}
                onView={() => viewBLFor(c)}
                onDownload={() => downloadBLFor(c)}
              />
            </>
          ) : (
            <>
              <DocPending label="Facture" icon={Receipt} />
              <DocPending label="Bon de livraison" icon={Truck} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Plus d'actions" variant="ghost" size="icon" title="Plus d'actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {hasFactureBL && canPayer && (
            soldeLoading ? (
              <DropdownMenuItem disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Paiement…
              </DropdownMenuItem>
            ) : showSolder ? (
              <DropdownMenuItem onSelect={() => setSolderOpen(true)}>
                <Wallet className="mr-2 h-4 w-4" /> Solder la facture
              </DropdownMenuItem>
            ) : null
          )}
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
          {!canEdit && !(isSuperAdmin && canDelete) && !showSolder && !soldeLoading && (
            <DropdownMenuItem disabled>Aucune autre action</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {solderOpen && (
        <SolderFactureDialog commande={c} open={solderOpen} onOpenChange={setSolderOpen} />
      )}
    </div>
  );
}
