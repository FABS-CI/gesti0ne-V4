import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FloatingCalculator } from "@/components/commandes/FloatingCalculator";
import { CommandeForm } from "@/components/commandes/CommandeForm";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const searchSchema = z.object({
  clientId: z.string().optional(),
  periode: z.string().or(z.number()).optional(),
}).passthrough();

export const Route = createFileRoute("/_authenticated/commandes/nouvelle")({
  validateSearch: zodValidator(searchSchema),
  component: CommandeNouvellePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function CommandeNouvellePage() {
  const search = Route.useSearch();
  const presetClientId = search.clientId;
  const { has, isLoading: permLoading } = usePermissions();
  const canManage = has("commandes.creer");

  if (!permLoading && !canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation de créer une commande.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/commandes">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/commandes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="ds-page-title">Nouvelle Commande</h1>
          <p className="text-sm text-muted-foreground">
            Proforma générée automatiquement · Facture &amp; BL si vous avez le droit de validation, sinon commande en attente
          </p>
        </div>
      </div>
      <CommandeForm mode="create" presetClientId={presetClientId} />
      <FloatingCalculator />
    </div>
  );
}
