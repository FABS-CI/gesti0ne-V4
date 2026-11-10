import { totalAchatsComptabilises } from "@/lib/achats-comptabilises";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA, formatDate } from "@/lib/format";
import { useExercice } from "@/contexts/ExerciceContext";
import { getDashboardCompta } from "@/lib/compta-api";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/common/StatusPill";
import { toneForStatut } from "@/lib/statut-tone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { COMPARATIF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { ListPageHeader } from "@/components/common/list/ListParts";
import { STATUT_LABEL } from "@/components/exercices/index/exercices-shared";
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
      const achats = totalAchatsComptabilises(ach.data ?? []);

      return {
        nbCommandes: cmd.data?.length ?? 0,
        totalCommandes,
        nbFactures: fac.data?.length ?? 0,
        totalFactures,
        totalPaye,
        resteAPayer: totalFactures - totalPaye,
        nbPaiements: pai.data?.length ?? 0,
        totalPaiements,
        nbAchats: achats.nb,
        totalAchats: achats.total,
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
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/exercices">
          <ArrowLeft className="mr-1 h-4 w-4" /> Exercices
        </Link>
      </Button>
      <ListPageHeader
        overline="Comptabilité · Exercices"
        title="Rapport d'exercice"
        description="Synthèse ventes et finances pour un exercice donné"
      />

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
            <StatusPill tone={exercice.is_actif ? "success" : toneForStatut(exercice.statut)}>
              {STATUT_LABEL[exercice.statut as keyof typeof STATUT_LABEL] ?? exercice.statut}
            </StatusPill>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="ds-overline">Activité commerciale</h2>
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
            />
            <Kpi
              label="Factures émises"
              value={formatFCFA(ventes.totalFactures)}
              hint={`${ventes.nbFactures} facture(s)`}
            />
            <Kpi
              label="Encaissements"
              value={formatFCFA(ventes.totalPaiements)}
              hint={`${ventes.nbPaiements} paiement(s)`}
            />
            <Kpi
              label="Reste à encaisser"
              value={formatFCFA(ventes.resteAPayer)}
              hint="Factures - déjà payé"
              tone={ventes.resteAPayer > 0 ? "danger" : undefined}
            />
            <Kpi
              label="Achats fournisseurs"
              value={formatFCFA(ventes.totalAchats)}
              hint={`${ventes.nbAchats} achat(s) reçu(s) ou payé(s)`}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="ds-overline">Situation comptable</h2>
        {loadingCompta || !compta ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="Produits (cl. 7)" value={formatFCFA(compta.produits)} />
            <Kpi label="Charges (cl. 6)" value={formatFCFA(compta.charges)} />
            <Kpi
              label="Résultat"
              value={formatFCFA(compta.resultat)}
              tone={compta.resultat >= 0 ? "success" : "danger"}
            />
            <Kpi label="Trésorerie (cl. 5)" value={formatFCFA(compta.tresorerie)} />
            <Kpi label="Créances clients (411)" value={formatFCFA(compta.creancesClients)} />
            <Kpi label="Dettes fournisseurs (401)" value={formatFCFA(compta.dettesFournisseurs)} />
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
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Couleur réservée aux montants à surveiller (résultat, reste à encaisser). */
  tone?: "success" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "success" && "text-success",
            tone === "danger" && "text-destructive",
          )}
        >
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
