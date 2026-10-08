import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Car,
  Wrench,
  Navigation,
  DollarSign,
  Package,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { genererAlertes } from "@/lib/notifications-api";
import { toast } from "sonner";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/dashboard-logistique")({
  component: DashboardLogistique,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Stats = {
  tourneesJour: number;
  tourneesEnCours: number;
  coutJour: number;
  coutMois: number;
  vehDispo: number;
  vehMission: number;
  vehMaint: number;
  livraisonsEnCours: number;
  expeditionsEnCours: number;
  colisJour: number;
};

async function loadDashboardLogistique(): Promise<{
  stats: Stats;
  alertes: { id: string; label: string; type: string }[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const debutMois = today.slice(0, 8) + "01";
  type TourneeRow = Database["public"]["Tables"]["tournees"]["Row"];
  const t = supabase.from("tournees");
  const [
    { data: tJour },
    { data: tMois },
    { data: tEnCours },
    { data: veh },
    { data: liv },
    { data: exp },
  ] = await Promise.all([
    t.select("cout_total, nb_colis").eq("date_tournee", today),
    t.select("cout_total").gte("date_tournee", debutMois),
    t.select("tournee_id").eq("statut", "en_cours"),
    supabase.from("vehicules").select("statut"),
    supabase.from("livraisons").select("livraison_id").eq("statut", "en_cours"),
    supabase.from("expeditions").select("expedition_id").eq("statut", "en_cours"),
  ]);
  const sumCost = (rows: Pick<TourneeRow, "cout_total">[] | null) =>
    (rows ?? []).reduce((a, r) => a + Number(r.cout_total ?? 0), 0);
  const sumColis = (rows: Pick<TourneeRow, "nb_colis">[] | null) =>
    (rows ?? []).reduce((a, r) => a + Number(r.nb_colis ?? 0), 0);
  const stats: Stats = {
    tourneesJour: tJour?.length ?? 0,
    tourneesEnCours: tEnCours?.length ?? 0,
    coutJour: sumCost(tJour),
    coutMois: sumCost(tMois),
    vehDispo: (veh ?? []).filter((v) => v.statut === "disponible").length,
    vehMission: (veh ?? []).filter((v) => v.statut === "en_mission").length,
    vehMaint: (veh ?? []).filter((v) => v.statut === "maintenance").length,
    livraisonsEnCours: liv?.length ?? 0,
    expeditionsEnCours: exp?.length ?? 0,
    colisJour: sumColis(tJour),
  };
  const SEUIL = 200000;
  const alertes: { id: string; label: string; type: string }[] = [];
  const { data: hors } = await supabase
    .from("tournees")
    .select("tournee_id, reference, cout_total")
    .gt("cout_total", SEUIL)
    .order("cout_total", { ascending: false })
    .limit(5);
  (hors ?? []).forEach((r) =>
    alertes.push({
      id: r.tournee_id,
      type: "Coût élevé",
      label: `Tournée ${r.reference} : ${formatFCFA(Number(r.cout_total))} (> ${formatFCFA(SEUIL)})`,
    }),
  );
  const dans30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data: vehAlertes } = await supabase
    .from("vehicules")
    .select(
      "vehicule_id, immatriculation, date_prochain_entretien, date_expiration_assurance, date_expiration_visite_technique",
    )
    .or(
      `date_prochain_entretien.lte.${dans30},` +
        `date_expiration_assurance.lte.${dans30},` +
        `date_expiration_visite_technique.lte.${dans30}`,
    );
  (vehAlertes ?? []).forEach((v) => {
    const im = v.immatriculation ?? v.vehicule_id;
    if (v.date_prochain_entretien && v.date_prochain_entretien <= dans30)
      alertes.push({
        id: `${v.vehicule_id}-ent`,
        type: "Entretien",
        label: `${im} — entretien prévu le ${formatDate(v.date_prochain_entretien)}`,
      });
    if (v.date_expiration_assurance && v.date_expiration_assurance <= dans30)
      alertes.push({
        id: `${v.vehicule_id}-ass`,
        type: "Assurance",
        label: `${im} — assurance expire le ${formatDate(v.date_expiration_assurance)}`,
      });
    if (v.date_expiration_visite_technique && v.date_expiration_visite_technique <= dans30)
      alertes.push({
        id: `${v.vehicule_id}-vt`,
        type: "Visite technique",
        label: `${im} — visite technique expire le ${formatDate(v.date_expiration_visite_technique)}`,
      });
  });
  return { stats, alertes };
}

function DashboardLogistique() {
  const { data } = useQuery({
    queryKey: ["dashboard-logistique"],
    queryFn: loadDashboardLogistique,
    staleTime: 30_000,
  });
  const s = data?.stats ?? null;
  const alertes = data?.alertes ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="ds-page-title">Tableau de bord logistique</h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble des tournées, véhicules et coûts
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const r = await genererAlertes();
              toast.success(`${r.created} alerte(s) créée(s)`, {
                description: r.skipped ? `${r.skipped} déjà existantes` : undefined,
              });
            } catch (e) {
              toast.error("Erreur lors de la génération", { description: String(e) });
            }
          }}
        >
          <Bell className="mr-2 h-4 w-4" /> Générer alertes
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          icon={Navigation}
          label="Tournées du jour"
          value={s?.tourneesJour ?? 0}
          color="#3B82F6"
        />
        <Kpi
          icon={Truck}
          label="Tournées en cours"
          value={s?.tourneesEnCours ?? 0}
          color="#F97316"
        />
        <Kpi
          icon={DollarSign}
          label="Coût du jour"
          value={formatFCFA(s?.coutJour ?? 0)}
          color="#10B981"
        />
        <Kpi
          icon={DollarSign}
          label="Coût du mois"
          value={formatFCFA(s?.coutMois ?? 0)}
          color="#14B8A6"
        />
        <Kpi icon={Car} label="Véhicules disponibles" value={s?.vehDispo ?? 0} color="#10B981" />
        <Kpi icon={Truck} label="Véhicules en mission" value={s?.vehMission ?? 0} color="#3B82F6" />
        <Kpi
          icon={Wrench}
          label="Véhicules en maintenance"
          value={s?.vehMaint ?? 0}
          color="#F59E0B"
        />
        <Kpi icon={Package} label="Colis du jour" value={s?.colisJour ?? 0} color="#8B5CF6" />
        <Kpi
          icon={Truck}
          label="Livraisons en cours"
          value={s?.livraisonsEnCours ?? 0}
          color="#3B82F6"
        />
        <Kpi
          icon={Truck}
          label="Expéditions en cours"
          value={s?.expeditionsEnCours ?? 0}
          color="#6366F1"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" /> Alertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte.</p>
          ) : (
            <ul className="space-y-2">
              {alertes.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{a.type}</Badge>
                    <span className="text-sm">{a.label}</span>
                  </div>
                  <Link to="/tournees" className="text-xs text-primary hover:underline">
                    Voir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Truck;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${color}1a` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
