import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  AlertTriangle,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  Briefcase,
  CalendarClock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { getDashboardCompta } from "@/lib/compta-api";
import { getRHDashboard } from "@/lib/rh-api";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { usePermissions } from "@/hooks/use-permissions";
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

  return (
    <div className="theme-dashboard space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LayoutDashboard className="h-6 w-6 text-primary" /> Tableau de bord global
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue consolidée ventes, stock, RH et comptabilité
          </p>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Chargement…</p>}

      {/* VENTES */}
      <Section
        title="Ventes"
        icon={ShoppingCart}
        color="var(--primary)"
        action={{ label: "Commandes", to: "/commandes" }}
      >
        <Kpi
          label="Commandes en cours"
          value={ventes.data?.commandesEnCours ?? 0}
          icon={ShoppingCart}
          color="var(--primary)"
        />
        <Kpi
          label="CA du mois"
          value={canSeeCA ? formatFCFA(ventes.data?.caMois ?? 0) : "—"}
          icon={TrendingUp}
          color="var(--success)"
        />
        <Kpi
          label="Factures impayées"
          value={ventes.data?.facturesImpayees ?? 0}
          icon={FileText}
          color="var(--warning)"
        />
        <Kpi
          label="Montant impayé"
          value={formatFCFA(ventes.data?.montantImpaye ?? 0)}
          icon={Wallet}
          color="var(--destructive)"
        />
      </Section>

      {/* STOCK */}
      <Section
        title="Stock & logistique"
        icon={Package}
        color="var(--primary)"
        action={{ label: "Produits", to: "/produits" }}
      >
        <Kpi
          label="Produits actifs"
          value={stock.data?.totalProduits ?? 0}
          icon={Package}
          color="var(--primary)"
        />
        <Kpi
          label="Ruptures"
          value={stock.data?.produitsRupture ?? 0}
          icon={AlertTriangle}
          color="var(--destructive)"
        />
        <Kpi
          label="Sous seuil d'alerte"
          value={stock.data?.produitsAlerte ?? 0}
          icon={AlertTriangle}
          color="var(--warning)"
        />
        <Kpi
          label="Valeur du stock"
          value={formatFCFA(stock.data?.valeurStock ?? 0)}
          icon={Wallet}
          color="var(--success)"
        />
      </Section>

      {/* RH */}
      <Section
        title="Ressources humaines"
        icon={Briefcase}
        color="var(--primary)"
        action={{ label: "RH", to: "/rh-dashboard" }}
      >
        <Kpi
          label="Employés actifs"
          value={rh.data?.employesActifs ?? 0}
          icon={Users}
          color="var(--primary)"
        />
        <Kpi
          label="Masse salariale"
          value={formatFCFA(rh.data?.masseSalariale ?? 0)}
          icon={Wallet}
          color="var(--primary)"
        />
        <Kpi
          label="Congés en attente"
          value={rh.data?.congesEnAttente ?? 0}
          icon={CalendarClock}
          color="var(--warning)"
        />
        <Kpi
          label="Contrats expirant (30j)"
          value={rh.data?.contratsExpirantBientot ?? 0}
          icon={AlertTriangle}
          color="var(--destructive)"
        />
      </Section>

      {/* COMPTA */}
      <Section
        title="Comptabilité"
        icon={Scale}
        color="var(--success)"
        action={{ label: "Compta", to: "/compta-dashboard" }}
      >
        <Kpi
          label="Produits (cl. 7)"
          value={formatFCFA(compta.data?.produits ?? 0)}
          icon={TrendingUp}
          color="var(--success)"
        />
        <Kpi
          label="Charges (cl. 6)"
          value={formatFCFA(compta.data?.charges ?? 0)}
          icon={TrendingDown}
          color="var(--destructive)"
        />
        <Kpi
          label="Résultat"
          value={formatFCFA(compta.data?.resultat ?? 0)}
          icon={Scale}
          color={(compta.data?.resultat ?? 0) >= 0 ? "var(--success)" : "var(--destructive)"}
        />
        <Kpi
          label="Trésorerie"
          value={formatFCFA(compta.data?.tresorerie ?? 0)}
          icon={Wallet}
          color="var(--warning)"
        />
      </Section>

      {/* ALERTES */}
      {rh.data?.alertes && rh.data.alertes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertes RH
            </CardTitle>
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

function Section({
  title,
  icon: Icon,
  color,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="h-5 w-5" style={{ color }} />
          {title}
        </h2>
        {action && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={action.to}>{action.label} →</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4" style={{ color }} />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold" style={{ color }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
