import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/stock/audit")({
  component: StockAuditPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Resume = {
  generated_at: string;
  total_produits: number;
  total_mouvements: number;
  ecarts_stock: number;
  stock_negatif: number;
  mouvements_orphelins_produit: number;
  mouvements_sans_utilisateur_90j: number;
  doublons_document: number;
  verdict: "GO_PRODUCTION" | "ANOMALIES_DETECTEES";
};

function StockAuditPage() {
  const { has } = usePermissions();
  const isAdmin = has("stock.voir_audit");

  const resumeQ = useQuery({
    queryKey: ["stock-audit-resume"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_stock_resume");
      if (error) throw error;
      return data as unknown as Resume;
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  const r = resumeQ.data;
  const go = r?.verdict === "GO_PRODUCTION";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#3B82F6]" />
          <div>
            <h1 className="text-2xl font-bold">Audit Stock &amp; Inventaire</h1>
            <p className="text-sm text-muted-foreground">
              Diagnostic en lecture seule — aucune modification effectuée
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => resumeQ.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Relancer l'audit
          </Button>
        </div>
      </div>

      {r && (
        <Card
          style={{
            borderColor: go ? "#10B981" : "#EF4444",
            borderWidth: 2,
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {go ? (
                <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
              )}
              Verdict : {go ? "GO PRODUCTION" : "ANOMALIES DÉTECTÉES"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Produits" value={r.total_produits} />
              <Kpi label="Mouvements" value={r.total_mouvements} />
              <Kpi label="Écarts de stock" value={r.ecarts_stock} danger={r.ecarts_stock > 0} />
              <Kpi
                label="Stock négatif"
                value={r.stock_negatif}
                danger={r.stock_negatif > 0}
              />
              <Kpi
                label="Mouvements orphelins"
                value={r.mouvements_orphelins_produit}
                danger={r.mouvements_orphelins_produit > 0}
              />
              <Kpi
                label="Doublons de document"
                value={r.doublons_document}
                danger={r.doublons_document > 0}
              />
              <Kpi
                label="Mvts sans utilisateur (90j)"
                value={r.mouvements_sans_utilisateur_90j}
                danger={r.mouvements_sans_utilisateur_90j > 0}
              />
              <Kpi
                label="Généré le"
                value={new Date(r.generated_at).toLocaleString("fr-FR")}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Phase 2 : <code>stocks_depots</code> est désormais l'unique source
          de vérité pour le stock. Il n'y a plus de « stock enregistré » à
          comparer, donc plus de recalcul à effectuer — le stock affiché est
          toujours calculé à partir des dépôts.
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  danger,
}: {
  label: string;
  value: number | string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="mt-1 text-xl font-bold"
        style={{ color: danger ? "#EF4444" : undefined }}
      >
        {value}
      </div>
    </div>
  );
}