import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingCalculator } from "@/components/commandes/FloatingCalculator";
import { CommandeForm, type CommandeFormValues } from "@/components/commandes/CommandeForm";
import { usePermissions } from "@/hooks/use-permissions";
import { getCommande, getCommandeLignes } from "@/lib/commandes-api";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/commandes/$commandeId/modifier")({
  component: CommandeModifierPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const STATUTS_MODIFIABLES = ["brouillon", "en_attente_validation"] as const;

function CommandeModifierPage() {
  const { commandeId } = Route.useParams();
  const navigate = useNavigate();
  const { has: hasPermission, isSuperAdmin, isLoading: permissionsLoading } = usePermissions();
  const canEdit = hasPermission("commandes.modifier");

  const { data: commande, isLoading } = useQuery({
    queryKey: ["commande", commandeId],
    queryFn: () => getCommande(commandeId),
  });
  const { data: lignes, isLoading: lignesLoading } = useQuery({
    queryKey: ["commande-lignes", commandeId],
    queryFn: () => getCommandeLignes(commandeId),
  });

  useEffect(() => {
    if (permissionsLoading) return;
    if (!commande) return;
    if (isSuperAdmin) return;
    if (!STATUTS_MODIFIABLES.includes(commande.statut as (typeof STATUTS_MODIFIABLES)[number])) {
      toast.error("Cette commande ne peut plus être modifiée");
      navigate({ to: "/commandes/$commandeId", params: { commandeId } });
    }
  }, [commande, commandeId, navigate, isSuperAdmin, permissionsLoading]);

  if (!permissionsLoading && !canEdit) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation de modifier une commande.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/commandes">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  if (permissionsLoading || isLoading || lignesLoading || !commande) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const initialValues: Partial<CommandeFormValues> = {
    date_commande: commande.date_commande,
    client_id: commande.client_id ?? "",
    etablissement: commande.etablissement ?? commande.client_nom ?? "",
    representant_nom: commande.representant_nom ?? "",
    telephone: commande.telephone ?? "",
    ville: commande.ville ?? "",
    adresse: commande.adresse ?? "",
    
    remise_globale_pct: Number(commande.remise_globale_pct ?? 0),
    taux_tva: Number(commande.taux_tva ?? 0),
    lignes: (() => {
      const map = new Map<
        string,
        {
          produit_id: string;
          reference_produit: string;
          designation: string;
          quantite: number;
          prix_unitaire: number;
          remise_pct: number;
          cover_path?: string | null;
          cover_thumb_path?: string | null;
        }
      >();
      for (const l of lignes ?? []) {
        const brut = (l.quantite || 0) * (Number(l.prix_unitaire) || 0);
        const remisePct =
          brut > 0
            ? Math.max(
                0,
                Math.min(100, Math.round((1 - Number(l.total_ligne) / brut) * 10000) / 100),
              )
            : 0;
        // Clé de fusion : produit_id si présent, sinon référence, sinon désignation+PU
        const key = l.produit_id
          ? `id:${l.produit_id}`
          : l.reference_produit
            ? `ref:${l.reference_produit}`
            : `des:${l.designation}|${Number(l.prix_unitaire)}`;
        const existing = map.get(key);
        if (existing) {
          existing.quantite += l.quantite;
        } else {
          const prod = l.produits;
          map.set(key, {
            produit_id: l.produit_id ?? "",
            reference_produit: l.reference_produit ?? "",
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire: Number(l.prix_unitaire),
            remise_pct: Number(l.remise_pct ?? remisePct),
            cover_path: prod?.cover_path || l.cover_path,
            cover_thumb_path: prod?.cover_thumb_path || l.cover_thumb_path,
          });
        }
      }
      return Array.from(map.values());
    })(),
  };

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
          <h1 className="text-2xl font-bold">Modifier la commande {commande.reference}</h1>
          <p className="text-sm text-muted-foreground">
            Toutes les modifications recalculent automatiquement les totaux et les documents liés.
          </p>
        </div>
      </div>
      <CommandeForm mode="edit" commandeId={commandeId} initialValues={initialValues} />
      <FloatingCalculator />
    </div>
  );
}
