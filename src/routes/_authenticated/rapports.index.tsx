import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useState } from "react";
import { FileBarChart } from "lucide-react";
import { toast } from "sonner";

import { useExercice } from "@/contexts/ExerciceContext";
import { Badge } from "@/components/ui/badge";
import { ReportCard } from "@/components/rapports/index/ReportCard";
import { exportReportPdf, fetchReportRows, type ReportDef } from "@/lib/rapports-index-helpers";
import { REPORTS } from "@/lib/rapports-index-defs";
import { usePermissions } from "@/hooks/use-permissions";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/rapports/")({
  head: () => authRouteHead("Rapports"),
  component: RapportsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function RapportsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const { exerciceConsulte, exerciceConsulteId } = useExercice();
  const { has, isLoading: permsLoading } = usePermissions();
  const visibleReports = REPORTS.filter((r) => !r.permission || has(r.permission));

  async function generate(def: ReportDef) {
    setLoading(def.table);
    try {
      const rows = await fetchReportRows(def, exerciceConsulteId);
      if (!rows.length) {
        toast.info(`Aucune donnée pour ${def.label}`);
        return;
      }
      exportReportPdf(def, rows);
      toast.success(`Rapport ${def.label} exporté`);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="theme-dashboard space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" /> Rapports
          </h1>
          <p className="text-sm text-muted-foreground">
            Génération et export des rapports (PDF) — filtrés sur l'exercice consulté
          </p>
        </div>
        {exerciceConsulte && <Badge variant="outline">Exercice : {exerciceConsulte.code}</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {permsLoading ? null : visibleReports.map((def) => (
          <ReportCard
            key={def.table}
            def={def}
            loading={loading === def.table}
            onExport={() => generate(def)}
          />
        ))}
      </div>
    </div>
  );
}
