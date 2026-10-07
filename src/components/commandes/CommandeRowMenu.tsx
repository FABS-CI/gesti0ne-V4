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
  CheckCircle,
  Receipt,
  Download,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

function DocButton({
  label,
  short,
  icon: Icon,
  onView,
  onDownload,
  disabled,
}: {
  label: string;
  short: string;
  icon: LucideIcon;
  onView: () => void;
  onDownload: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={disabled}
          title={disabled ? `${label} — pas encore générée` : label}
          aria-label={label}
        >
          <Icon className="mr-1 h-4 w-4" /> {short}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled className="text-xs font-semibold uppercase opacity-100">
          {label}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onView}>
          <Eye className="mr-2 h-4 w-4" /> Visualiser
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download className="mr-2 h-4 w-4" /> Télécharger
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [solderOpen, setSolderOpen] = useState(false);
  const { data: solde } = useQuery({
    queryKey: ["facture-solde", c.commande_id],
    queryFn: () => loadFactureSolde(c.commande_id),
    enabled: hasFactureBL && canPayer,
    staleTime: 60_000,
  });
  const showSolder = hasFactureBL && canPayer && !!solde && solde.statut !== "PAYÉE";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
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
      <DocButton label="Proforma" short="PF" icon={FileText} onView={() => viewProforma(c)} onDownload={() => downloadProforma(c)} />
      <DocButton label="Bon de commande" short="BC" icon={ShoppingCart} onView={() => viewBonCommande(c)} onDownload={() => downloadBonCommande(c)} />
      <DocButton label="Facture" short="FAC" icon={Receipt} disabled={!hasFactureBL} onView={() => viewFactureFor(c)} onDownload={() => downloadFactureFor(c)} />
      <DocButton label="Bon de livraison" short="BL" icon={Truck} disabled={!hasFactureBL} onView={() => viewBLFor(c)} onDownload={() => downloadBLFor(c)} />
      {showSolder && (
        <Button variant="ghost" size="icon" title="Solder la facture" aria-label="Solder la facture" onClick={() => setSolderOpen(true)}>
          <Wallet className="h-4 w-4 text-accent" />
        </Button>
      )}
      {canEdit && (
        <Button asChild variant="ghost" size="icon" title="Modifier" aria-label="Modifier">
          <Link to="/commandes/$commandeId/modifier" params={{ commandeId: c.commande_id }}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {isSuperAdmin && canDelete && (
        <Button variant="ghost" size="icon" title="Supprimer définitivement" aria-label="Supprimer définitivement" onClick={() => onDelete(c)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
      {solderOpen && (
        <SolderFactureDialog commande={c} open={solderOpen} onOpenChange={setSolderOpen} />
      )}
    </div>
  );
}
