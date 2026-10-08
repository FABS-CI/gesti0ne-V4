import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/format";
import { getDashboardCompta } from "@/lib/compta-api";
import { getRHDashboard } from "@/lib/rh-api";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { usePermissions } from "@/hooks/use-permissions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/dashboard-global")({
  component: DashboardGlobal,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type VentesStats = {
  commandesEnCours: number;
  caMois: number;
  facturesImpayees: number;
  montantImpaye: number;
};
type StockStats = {
  totalProduits: number;
  produitsRupture: number;
  produitsAlerte: number;
  valeurStock: number;
};

async function getVentesStats(exerciceId?: string | null): Promise<VentesStats> {
  const startMonth = new Date();
  startMonth.setDate(1);
  const startStr = startMonth.toISOString().slice(0, 10);

  let cmdQ = supabase.from("commandes").select("commande_id, statut, montant_total, date_commande");
  let facQ = supabase
    .from("factures")
    .select("facture_id, montant_total, montant_paye, statut, date_facture");
  if (exerciceId) {
    cmdQ = cmdQ.eq("exercice_id", exerciceId);
    facQ = facQ.eq("exercice_id", exerciceId);
  }
  const [cmd, fac] = await Promise.all([cmdQ, facQ]);
  const commandes = cmd.data ?? [];
  const factures = fac.data ?? [];
  const commandesEnCours = commandes.filter(
    (c) => c.statut === "confirmee" || c.statut === "brouillon",
  ).length;
  // CA = factures émises (commande convertie en facture), non annulées
  const caMois = factures
    .filter((f) => (f.date_facture ?? "") >= startStr && f.statut !== "annulee")
    .reduce((s, f) => s + Number(f.montant_total ?? 0), 0);
  const impayees = factures.filter((f) => f.statut === "impayee" || f.statut === "partielle");
  return {
    commandesEnCours,
    caMois,
    facturesImpayees: impayees.length,
    montantImpaye: impayees.reduce(
      (s, f) => s + (Number(f.montant_total ?? 0) - Number(f.montant_paye ?? 0)),
      0,
    ),
  };
}

async function getStockStats(): Promise<StockStats> {
  const { data } = await supabase
    .from("v_produits")
    .select("produit_id, stock, seuil_alerte, prix_vente, actif");
  const produits = (data ?? []).filter((p) => p.actif !== false);
  const produitsRupture = produits.filter((p) => Number(p.stock ?? 0) <= 0).length;
  const produitsAlerte = produits.filter(
    (p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.seuil_alerte ?? 0),
  ).length;
  const valeurStock = produits.reduce(
    (s, p) => s + Number(p.stock ?? 0) * Number(p.prix_vente ?? 0),
    0,
  );
  return {
    totalProduits: produits.length,
    produitsRupture,
    produitsAlerte,
    valeurStock,
  };
}

function DashboardGlobal() {
  const exerciceId = useExerciceConsulteId();
  const { has: hasPerm } = usePermissions();
  const canSeeCA = hasPerm("dashboard.voir_ca");
  const ventes = useQuery({
    queryKey: ["global-ventes", exerciceId],
    queryFn: () => getVentesStats(exerciceId),
  });
  const stock = useQuery({ queryKey: ["global-stock"], queryFn: getStockStats });
  const rh = useQuery({ queryKey: ["global-rh"], queryFn: getRHDashboard });
  const compta = useQuery({
    queryKey: ["global-compta", exerciceId],
    queryFn: () => getDashboardCompta(undefined, undefined, exerciceId),
  });

  const loading = ventes.isLoading || stock.isLoading || rh.isLoading || compta.isLoading;

  const caMois = ventes.data?.caMois ?? 0;
  const impayees = ventes.data?.facturesImpayees ?? 0;
  const montantImpaye = ventes.data?.montantImpaye ?? 0;
  const ruptures = stock.data?.produitsRupture ?? 0;
  const alertes = stock.data?.produitsAlerte ?? 0;
  const conges = rh.data?.congesEnAttente ?? 0;
  const contrats = rh.data?.contratsExpirantBientot ?? 0;
  const resultat = compta.data?.resultat ?? 0;
  const tresorerie = compta.data?.tresorerie ?? 0;

  return (
    <div className="theme-dashboard space-y-6">
      <div>
        <h1 className="ds-page-title">Tableau de bord global</h1>
        <p className="text-sm text-muted-foreground">
          Vue consolidée ventes, stock, RH et comptabilité
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Chargement…</p>}

      <SectionHeader title="Ventes" action={{ label: "Voir les commandes", to: "/commandes" }}>
        <KpiCard
          label="Commandes en cours"
          value={ventes.data?.commandesEnCours ?? 0}
          isZero={(ventes.data?.commandesEnCours ?? 0) === 0}
          to="/commandes"
        />
        <KpiCard
          label="CA du mois"
          value={canSeeCA ? formatFCFA(caMois) : "—"}
          isZero={canSeeCA && caMois === 0}
        />
        <KpiCard
          label="Factures impayées"
          value={impayees}
          isZero={impayees === 0}
          to="/factures"
        />
        <KpiCard
          label="Montant impayé"
          value={formatFCFA(montantImpaye)}
          isZero={montantImpaye === 0}
          to="/factures"
        />
      </SectionHeader>

      <SectionHeader
        title="Stock & logistique"
        action={{ label: "Voir les produits", to: "/produits" }}
      >
        <KpiCard
          label="Produits actifs"
          value={stock.data?.totalProduits ?? 0}
          isZero={(stock.data?.totalProduits ?? 0) === 0}
          to="/produits"
        />
        <KpiCard
          label="Ruptures"
          value={ruptures}
          isZero={ruptures === 0}
          tone="destructive"
          stateLabel="À traiter"
          to="/stock"
        />
        <KpiCard
          label="Sous seuil d'alerte"
          value={alertes}
          isZero={alertes === 0}
          tone="warning"
          stateLabel="En alerte"
          to="/stock"
        />
        <KpiCard
          label="Valeur du stock"
          value={formatFCFA(stock.data?.valeurStock ?? 0)}
          isZero={(stock.data?.valeurStock ?? 0) === 0}
        />
      </SectionHeader>

      <SectionHeader
        title="Ressources humaines"
        action={{ label: "Voir les employés", to: "/rh-dashboard" }}
      >
        <KpiCard
          label="Employés actifs"
          value={rh.data?.employesActifs ?? 0}
          isZero={(rh.data?.employesActifs ?? 0) === 0}
          to="/employes"
        />
        <KpiCard
          label="Masse salariale"
          value={formatFCFA(rh.data?.masseSalariale ?? 0)}
          isZero={(rh.data?.masseSalariale ?? 0) === 0}
          to="/paie"
        />
        <KpiCard
          label="Congés en attente"
          value={conges}
          isZero={conges === 0}
          tone="warning"
          stateLabel="À traiter"
          to="/conges"
        />
        <KpiCard
          label="Contrats expirant (30j)"
          value={contrats}
          isZero={contrats === 0}
          tone="warning"
          stateLabel="En alerte"
          to="/contrats"
        />
      </SectionHeader>

      <SectionHeader
        title="Comptabilité"
        action={{ label: "Voir la comptabilité", to: "/compta-dashboard" }}
      >
        <KpiCard
          label="Produits (cl. 7)"
          value={formatFCFA(compta.data?.produits ?? 0)}
          isZero={(compta.data?.produits ?? 0) === 0}
        />
        <KpiCard
          label="Charges (cl. 6)"
          value={formatFCFA(compta.data?.charges ?? 0)}
          isZero={(compta.data?.charges ?? 0) === 0}
        />
        <KpiCard
          label="Résultat"
          value={formatFCFA(resultat)}
          isZero={resultat === 0}
          tone={resultat < 0 ? "destructive" : "success"}
          stateLabel={resultat < 0 ? "Négatif" : "Positif"}
        />
        <KpiCard
          label="Trésorerie"
          value={formatFCFA(tresorerie)}
          isZero={tresorerie === 0}
          tone={tresorerie < 0 ? "destructive" : "neutral"}
          stateLabel="Négatif"
        />
      </SectionHeader>

      {rh.data?.alertes && rh.data.alertes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertes RH</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rh.data.alertes.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge
                  variant={
                    a.severite === "danger"
                      ? "destructive"
                      : a.severite === "warning"
                        ? "default"
                        : "secondary"
                  }
                >
                  {a.severite}
                </Badge>
                <span>{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
