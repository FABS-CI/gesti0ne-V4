import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProductCoverActions } from "@/components/produits/ProductCoverActions";
import { ArrowLeft } from "lucide-react";
import { buildProduitHistorique } from "@/lib/produits-360-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useProduitDetail } from "@/hooks/use-produit-detail";
import { KpiCards } from "@/components/produits/detail/KpiCards";
import { InfoCards } from "@/components/produits/detail/InfoCards";
import { VentesTab } from "@/components/produits/detail/VentesTab";
import { MouvementsTab } from "@/components/produits/detail/MouvementsTab";
import { AchatsTab } from "@/components/produits/detail/AchatsTab";
import { InventairesTab } from "@/components/produits/detail/InventairesTab";
import { HistoriqueTab } from "@/components/produits/detail/HistoriqueTab";
import { DepotsStockTab } from "@/components/produits/detail/DepotsStockTab";
import { ProductCoverHero } from "@/components/produits/ProductCoverHero";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const StockAreaChart = lazy(() => import("@/components/charts/StockAreaChart"));

export const Route = createFileRoute("/_authenticated/produits/$produitId")({
  component: ProduitDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ProduitDetailPage() {
  const { produitId } = Route.useParams();
  const queryClient = useQueryClient();
  const { hasRole, hasAny } = useUserRoles();
  const isAssistanteOnly =
    (hasRole("assistante") || hasRole("comptable") || hasRole("secretariat")) &&
    !hasAny([
      "super_admin",
      "directeur_general",
      "directeur_commercial",
      "gestionnaire_stock",
      "responsable_magasinier",
      "service_logistique",
    ]);

  const {
    produit,
    isLoading,
    mouvements,
    ventes,
    stats,
    history,
    stocksDepots,
    achats,
    inventaires,
  } = useProduitDetail(produitId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isAssistanteOnly) {
    return (
      <div className="p-8 text-center">
        <h1 className="ds-page-title">Accès refusé</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Vous n'avez pas l'autorisation de consulter la fiche détaillée d'un produit.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/produits">Retour aux produits</Link>
        </Button>
      </div>
    );
  }
  if (!produit)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Produit introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/produits">Retour</Link>
        </Button>
      </div>
    );

  const enAlerte = (produit.stock || 0) <= (produit.seuil_alerte || 0);
  const stockValorise = (produit.stock || 0) * (produit.prix_vente || 0);
  const historique = buildProduitHistorique({ achats, inventaires, mouvements, ventes });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button aria-label="Retour" asChild variant="ghost" size="icon">
            <Link to="/produits">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="ds-page-title">{produit.titre}</h1>
            <p className="text-sm text-muted-foreground">
              {produit.reference} · {produit.categorie}
            </p>
          </div>
        </div>
        <Badge variant="secondary">Consulter l'onglet Dépôts pour le stock</Badge>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <ProductCoverHero produit={produit} />
          <ProductCoverActions
            produit={produit}
            onChanged={(updated) => {
              if (updated) {
                queryClient.setQueryData(["produit", produitId], updated);
              }
              queryClient.invalidateQueries({ queryKey: ["produit", produitId] });
            }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <KpiCards stockValorise={stockValorise} stats={stats} />
          <InfoCards
            isbn={produit.isbn}
            prix_vente={produit.prix_vente}
            prix_achat={produit.prix_achat}
            seuil_alerte={produit.seuil_alerte}
          />
        </div>
      </div>


      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="depots">Dépôts</TabsTrigger>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          <TabsTrigger value="achats">Achats</TabsTrigger>
          <TabsTrigger value="inventaires">Inventaires</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Niveau : </span>
                {produit.niveau ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Matière : </span>
                {produit.matiere ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Auteur : </span>
                {produit.auteur ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Éditeur : </span>
                {produit.editeur ?? "—"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depots">
          <DepotsStockTab produitId={produitId} stocksDepots={stocksDepots} />
        </TabsContent>

        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle>Évolution du stock (90 jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <StockAreaChart data={history} />
                </Suspense>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventes">
          <VentesTab ventes={ventes} />
        </TabsContent>

        <TabsContent value="mouvements">
          <MouvementsTab mouvements={mouvements} />
        </TabsContent>

        <TabsContent value="achats">
          <AchatsTab achats={achats} />
        </TabsContent>

        <TabsContent value="inventaires">
          <InventairesTab inventaires={inventaires} />
        </TabsContent>

        <TabsContent value="historique">
          <HistoriqueTab historique={historique} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
