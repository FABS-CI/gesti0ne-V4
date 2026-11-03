import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, FileText, Scale } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChiffreAffairesChart,
  ProduitsChargesChart,
  RepartitionCharges,
} from "@/components/comptabilite/ComptaCharts";
import { getTableauDeBordCompta } from "@/lib/compta-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { useExercice } from "@/contexts/ExerciceContext";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/compta-dashboard")({
  component: ComptaDashboard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function Indicateur({
  label,
  valeur,
  detail,
  ton,
}: {
  label: string;
  valeur: string;
  detail?: string;
  ton?: "positif" | "negatif";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-bold ${
            ton === "positif"
              ? "text-success"
              : ton === "negatif"
                ? "text-destructive"
                : "text-foreground"
          }`}
        >
          {valeur}
        </p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function ComptaDashboard() {
  const { exerciceConsulte } = useExercice();
  const exerciceId = exerciceConsulte?.exercice_id;
  const q = useQuery({
    queryKey: ["compta-dashboard", exerciceId],
    enabled: !!exerciceId,
    queryFn: () => getTableauDeBordCompta(exerciceId!),
  });
  const t = q.data;
  const r = t?.resultat;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title">Tableau de bord comptable</h1>
          <p className="text-sm text-muted-foreground">
            {exerciceConsulte
              ? `Exercice ${exerciceConsulte.code} — calculé sur les écritures enregistrées`
              : "Aucun exercice sélectionné"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/comptabilite">
              <BookOpen className="mr-2 h-4 w-4" /> Journal
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/balance">
              <Scale className="mr-2 h-4 w-4" /> Balance
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/grand-livre">
              <FileText className="mr-2 h-4 w-4" /> Grand livre
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/rapports-comptables">
              <BarChart3 className="mr-2 h-4 w-4" /> Rapports
            </Link>
          </Button>
        </div>
      </div>

      {q.error ? (
        <p className="text-sm text-destructive">
          {friendlyError(q.error, "Indicateurs indisponibles")}
        </p>
      ) : !t || !r ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Résultat de l&apos;exercice
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                label={r.resultat >= 0 ? "Bénéfice" : "Perte"}
                valeur={formatFCFA(Math.abs(r.resultat))}
                ton={r.resultat >= 0 ? "positif" : "negatif"}
                detail={r.hao ? `Dont hors activités ordinaires : ${formatFCFA(r.hao)}` : undefined}
              />
              <Indicateur
                label="Chiffre d'affaires (comptes 70)"
                valeur={formatFCFA(r.chiffre_affaires)}
              />
              <Indicateur label="Produits (classe 7)" valeur={formatFCFA(r.produits)} />
              <Indicateur label="Charges (classe 6)" valeur={formatFCFA(r.charges)} />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Situation au {formatDate(t.periode.situation)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                label="Trésorerie (classe 5)"
                valeur={formatFCFA(t.situation.tresorerie)}
                ton={t.situation.tresorerie < 0 ? "negatif" : undefined}
                detail="Banques, caisse et virements, soldes antérieurs compris"
              />
              <Indicateur
                label="Créances clients (41)"
                valeur={formatFCFA(t.situation.creances_clients)}
              />
              <Indicateur
                label="Dettes fournisseurs (40)"
                valeur={formatFCFA(t.situation.dettes_fournisseurs)}
              />
              <Indicateur
                label="Dettes sociales et fiscales (42 à 44)"
                valeur={formatFCFA(t.situation.dettes_sociales_fiscales)}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Activité comptable
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                label="Écritures"
                valeur={String(t.ecritures.total)}
                detail={`${t.ecritures.validees} validées · ${t.ecritures.brouillons} en brouillon · ${t.ecritures.annulees} annulées par contre-passation`}
              />
              <Indicateur
                label="Comptes mouvementés"
                valeur={String(t.mouvements.comptes_mouvementes)}
              />
              <Indicateur
                label="Mouvements débit / crédit"
                valeur={formatFCFA(t.mouvements.debit)}
                ton={
                  Math.abs(t.mouvements.debit - t.mouvements.credit) > 0.01 ? "negatif" : undefined
                }
                detail={
                  Math.abs(t.mouvements.debit - t.mouvements.credit) > 0.01
                    ? `Crédit ${formatFCFA(t.mouvements.credit)} : écart à examiner (Audit comptable)`
                    : "Débit = crédit"
                }
              />
              <Indicateur
                label="Soldes débiteurs / créditeurs"
                valeur={formatFCFA(t.mouvements.soldes_debiteurs)}
                detail={`Créditeurs : ${formatFCFA(t.mouvements.soldes_crediteurs)}`}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Produits et charges par mois</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ProduitsChargesChart data={t.mensuel} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chiffre d&apos;affaires mensuel</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ChiffreAffairesChart data={t.mensuel} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Répartition des charges</CardTitle>
              <Button variant="link" size="sm" asChild>
                <Link to="/rapports-comptables">Détail mensuel</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <RepartitionCharges data={t.charges_par_compte} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
