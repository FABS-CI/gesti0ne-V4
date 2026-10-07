import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CreditCard, FileText, Plus, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { VenteRapideDialog } from "@/components/commandes/VenteRapideDialog";

/** Barre d'actions rapides : chaque bouton respecte la permission de sa page cible. */
export function DashboardQuickActions() {
  const { has } = usePermissions();
  const [venteRapide, setVenteRapide] = useState(false);
  const canCommande = has("commandes.creer");

  const items = [
    canCommande && { to: "/commandes/nouvelle" as const, label: "Nouvelle commande", icon: Plus },
    has("clients.creer") && { to: "/clients/nouveau" as const, label: "Nouveau client", icon: UserPlus },
    has("factures.voir") && { to: "/factures" as const, label: "Factures", icon: FileText },
    has("paiements.creer") && { to: "/paiements/nouveau" as const, label: "Enregistrer un paiement", icon: CreditCard },
  ].filter(Boolean) as { to: "/commandes/nouvelle" | "/clients/nouveau" | "/factures" | "/paiements/nouveau"; label: string; icon: typeof Plus }[];

  if (!canCommande && items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Actions rapides
      </span>
      {canCommande && (
        <Button size="sm" onClick={() => setVenteRapide(true)}>
          <Zap className="mr-1.5 h-4 w-4" /> Vente rapide
        </Button>
      )}
      {items.map((i) => (
        <Button key={i.to} size="sm" variant="outline" asChild>
          <Link to={i.to}>
            <i.icon className="mr-1.5 h-4 w-4" /> {i.label}
          </Link>
        </Button>
      ))}
      {venteRapide && <VenteRapideDialog open={venteRapide} onOpenChange={setVenteRapide} />}
    </div>
  );
}
