import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertCircle,
  FileBarChart,
  ShoppingCart,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  Users,
  Truck,
  Package,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA, formatDate } from "@/lib/format";
import { useExercice } from "@/contexts/ExerciceContext";
import { getDashboardCompta } from "@/lib/compta-api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { COMPARATIF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/exercices/rapport")({
  validateSearch: (s: Record<string, unknown>): { exercice?: string } => ({
    exercice: typeof s.exercice === "string" ? s.exercice : undefined,
  }),
  component: RapportExercicePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function RapportExercicePage() {
  const { exercices, exerciceConsulte } = useExercice();
  const { exercice: exerciceParam } = Route.useSearch();
  const paramInvalid =
    !!exerciceParam &&
    exercices.length > 0 &&
    !exercices.some((e) => e.exercice_id === exerciceParam);
  const [selectedId, setSelectedId] = useState<string | null>(
    (exerciceParam && !paramInvalid ? exerciceParam : null) ??
      exerciceConsulte?.exercice_id ??
      null,
  );

  const exercice = useMemo(
    () => exercices.find((e) => e.exercice_id === selectedId) ?? null,
    [exercices, selectedId],
  );

  const {
    data: ventes,
    isLoading: loadingVentes,
    error: ventesError,
  } = useQuery({
    enabled: !!selectedId,
    queryKey: ["rapport-exercice-ventes", selectedId],
    queryFn: async () => {
      const [cmd, fac, pai, ach] = await Promise.all([
        supabase
          .from("commandes")
          .select("commande_id, montant_ttc, net_a_payer, statut")
          .eq("exercice_id", selectedId!),
        supabase
          .from("factures")
          .select("facture_id, montant_total, montant_paye, statut")
          .eq("exercice_id", selectedId!),
        supabase
          .from("paiements")
          .select("paiement_id, montant, statut")
          .eq("exercice_id", selectedId!),
        supabase.from("achats").select("achat_id, montant, statut").eq("exercice_id", selectedId!),
      ]);
      if (cmd.error) throw cmd.error;
      if (fac.error) throw fac.error;
      if (pai.error) throw pai.error;
      if (ach.error) throw ach.error;

      const totalCommandes = (cmd.data ?? []).reduce(
        (s, r) => s + Number(r.net_a_payer ?? r.montant_ttc ?? 0),
        0,
      );
      const totalFactures = (fac.data ?? []).reduce((s, r) => s + Number(r.montant_total ?? 0), 0);
      const totalPaye = (fac.data ?? []).reduce((s, r) => s + Number(r.montant_paye ?? 0), 0);
      const totalPaiements = (pai.data ?? [])
        .filter((r) => r.statut !== "annule")
        .reduce((s, r) => s + Number(r.montant ?? 0), 0);
      const totalAchats = (ach.data ?? []).reduce((s, r) => s + Number(r.montant ?? 0), 0);

      return {
        nbCommandes: cmd.data?.length ?? 0,
        totalCommandes,
        nbFactures: fac.data?.length ?? 0,
        totalFactures,
        totalPaye,
        resteAPayer: totalFactures - totalPaye,
        nbPaiements: pai.data?.length ?? 0,
        totalPaiements,
        nbAchats: ach.data?.length ?? 0,
        totalAchats,
      };
    },
  });

  const { data: compta, isLoading: loadingCompta } = useQuery({
    enabled: !!exercice,
    queryKey: ["rapport-exercice-compta", selectedId],
    queryFn: () => getDashboardCompta(exercice!.date_debut, exercice!.date_fin, selectedId),
  });

  if (paramInvalid) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Exercice introuvable</AlertTitle>
          <AlertDescription>
            L'identifiant d'exercice fourni ne correspond à aucun exercice existant.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/exercices/comparatif" search={COMPARATIF_SEARCH_DEFAULTS}>
            Retour au comparatif
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/exercices">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="ds-page-title flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" /> Rapport d'exercice
          </h1>
          <p className="text-sm text-muted-foreground">
            Synthèse ventes et finances pour un exercice donné
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Exercice</label>
            <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercices.map((e) => (
                  <SelectItem key={e.exercice_id} value={e.exercice_id}>
                    {e.code} ({formatDate(e.date_debut)} → {formatDate(e.date_fin)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {exercice && (
            <Badge variant={exercice.is_actif ? "default" : "outline"}>
              {exercice.statut}
              {exercice.is_actif && " ●"}
            </Badge>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activité commerciale</h2>
        {ventesError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Données indisponibles</AlertTitle>
            <AlertDescription>
              {ventesError instanceof Error ? ventesError.message : "Erreur inattendue"}
            </AlertDescription>
          </Alert>
        ) : !selectedId ? (
          <p className="text-sm text-muted-foreground">Sélectionnez un exercice ci-dessus.</p>
        ) : loadingVentes || !ventes ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Commandes"
              value={formatFCFA(ventes.totalCommandes)}
              hint={`${ventes.nbCommandes} commande(s)`}
              icon={ShoppingCart}
              color="#3B82F6"
            />
            <Kpi
              label="Factures émises"
              value={formatFCFA(ventes.totalFactures)}
              hint={`${ventes.nbFactures} facture(s)`}
              icon={FileText}
              color="#8B5CF6"
            />
            <Kpi
              label="Encaissements"
              value={formatFCFA(ventes.totalPaiements)}
              hint={`${ventes.nbPaiements} paiement(s)`}
              icon={Wallet}
              color="#10B981"
            />
            <Kpi
              label="Reste à encaisser"
              value={formatFCFA(ventes.resteAPayer)}
              hint="Factures - déjà payé"
              icon={Users}
              color={ventes.resteAPayer > 0 ? "#EF4444" : "#10B981"}
            />
            <Kpi
              label="Achats fournisseurs"
              value={formatFCFA(ventes.totalAchats)}
              hint={`${ventes.nbAchats} achat(s)`}
              icon={Package}
              color="#F97316"
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Situation comptable</h2>
        {loadingCompta || !compta ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Produits (cl. 7)"
              value={formatFCFA(compta.produits)}
              icon={TrendingUp}
              color="#10B981"
            />
            <Kpi
              label="Charges (cl. 6)"
              value={formatFCFA(compta.charges)}
              icon={TrendingDown}
              color="#EF4444"
            />
            <Kpi
              label="Résultat"
              value={formatFCFA(compta.resultat)}
              icon={Scale}
              color={compta.resultat >= 0 ? "#10B981" : "#EF4444"}
            />
            <Kpi
              label="Trésorerie (cl. 5)"
              value={formatFCFA(compta.tresorerie)}
              icon={Wallet}
              color="#F97316"
            />
            <Kpi
              label="Créances clients (411)"
              value={formatFCFA(compta.creancesClients)}
              icon={Users}
              color="#3B82F6"
            />
            <Kpi
              label="Dettes fournisseurs (401)"
              value={formatFCFA(compta.dettesFournisseurs)}
              icon={Truck}
              color="#8B5CF6"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-5 w-5" style={{ color }} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color }}>
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
