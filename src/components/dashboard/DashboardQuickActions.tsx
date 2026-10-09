import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CreditCard, FileText, Plus, ScrollText, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { VenteRapideDialog } from "@/components/commandes/VenteRapideDialog";

type QuickTo =
  | "/commandes/nouvelle"
  | "/clients/nouveau"
  | "/factures"
  | "/etat-compte-clients"
  | "/paiements/nouveau";

/**
 * Barre d'actions rapides : chaque bouton respecte la permission de sa page cible.
 * Hiérarchie : une seule action principale (Vente rapide, couleur primaire),
 * les autres en bouton secondaire plein et contrasté, identiques entre eux.
 */
const SECONDARY =
  "h-9 justify-start border border-border bg-secondary font-medium text-secondary-foreground hover:bg-muted hover:border-foreground/30 active:bg-muted/80 disabled:opacity-50";

export function DashboardQuickActions() {
  const { has } = usePermissions();
  const [venteRapide, setVenteRapide] = useState(false);
  const canCommande = has("commandes.creer");

  const items = [
    canCommande && { to: "/commandes/nouvelle" as const, label: "Nouvelle commande", icon: Plus },
    has("clients.creer") && { to: "/clients/nouveau" as const, label: "Nouveau client", icon: UserPlus },
    has("factures.voir") && { to: "/factures" as const, label: "Factures", icon: FileText },
    has("etat_compte_clients.voir") && {
      to: "/etat-compte-clients" as const,
      label: "États de compte clients",
      icon: ScrollText,
    },
    has("paiements.creer") && { to: "/paiements/nouveau" as const, label: "Enregistrer un paiement", icon: CreditCard },
  ].filter(Boolean) as { to: QuickTo; label: string; icon: typeof Plus }[];

  if (!canCommande && items.length === 0) return null;

  return (
    <section aria-label="Actions rapides" className="rounded-md border bg-card px-3 py-2.5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Actions rapides
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        {canCommande && (
          <Button
            className="h-9 justify-start font-semibold hover:bg-primary/90 active:bg-primary/80"
            onClick={() => setVenteRapide(true)}
          >
            <Zap className="mr-1.5 h-4 w-4" /> Vente rapide
          </Button>
        )}
        {items.map((i) => (
          <Button key={i.to} variant="ghost" className={SECONDARY} asChild>
            <Link to={i.to}>
              <i.icon className="mr-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-nowrap">{i.label}</span>
            </Link>
          </Button>
        ))}
      </div>
      {venteRapide && <VenteRapideDialog open={venteRapide} onOpenChange={setVenteRapide} />}
    </section>
  );
}
