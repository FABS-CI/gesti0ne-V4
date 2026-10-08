import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/rapports-comptables")({
  component: () => (
    <ModulePlaceholder
      title="Rapports Comptables"
      subtitle="Analyses et tableaux de synthèse"
      icon={BarChart3}
      color="var(--warning)"
      description="Rapports analytiques : évolution des produits et charges, ratios financiers, marges, synthèse mensuelle et annuelle."
      shortcuts={[
        { label: "Tableau de bord compta", to: "/compta-dashboard" },
        { label: "Balance", to: "/balance" },
      ]}
      bullets={[
        "Ventilation produits / charges",
        "Ratios et indicateurs clés",
        "Comparatifs multi-périodes",
      ]}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
