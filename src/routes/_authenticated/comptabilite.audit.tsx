import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { usePermissions } from "@/hooks/use-permissions";
import { formatFCFA } from "@/lib/format";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/comptabilite/audit")({
  component: ComptaAuditPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Resume = {
  generated_at: string;
  total_ecritures: number;
  total_factures: number;
  total_paiements: number;
  ecritures_desequilibrees: number;
  factures_incoherentes: number;
  soldes_clients_incoherents: number;
  paiements_orphelins: number;
  doublons_paiement: number;
  verdict: "GO_PRODUCTION" | "ANOMALIES_DETECTEES";
};

type FactAnom = {
  facture_id: string;
  reference: string;
  client_nom: string;
  montant_total: number;
  montant_paye_enregistre: number;
  montant_paye_calcule: number;
  ecart: number;
  statut: string;
  probleme: string;
};

type SoldeCli = {
  client_id: string;
  reference: string;
  nom: string;
  solde_enregistre: number;
  solde_calcule: number;
  ecart: number;
};

function ComptaAuditPage() {
  const { has } = usePermissions();
  const canView = has("audit");
  const canRecalcAll = has("audit.recalculer_soldes");
  const qc = useQueryClient();

  const resumeQ = useQuery({
    queryKey: ["compta-audit-resume"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_finances_resume");
      if (error) throw error;
      return data as unknown as Resume;
    },
    enabled: canView,
  });

  const facturesQ = useQuery({
    queryKey: ["compta-audit-factures"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_compta_factures_anomalies");
      if (error) throw error;
      return (data ?? []) as FactAnom[];
    },
    enabled: canView,
  });

  const soldesQ = useQuery({
    queryKey: ["compta-audit-soldes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_compta_soldes_ecarts");
      if (error) throw error;
      return (data ?? []) as SoldeCli[];
    },
    enabled: canView,
  });

  const recalcClient = useMutation({
    mutationFn: async (client_id: string) => {
      const { data, error } = await supabase.rpc("recalculer_solde_client", {
        _client_id: client_id,
        _motif: "Correction manuelle page audit",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Solde client recalculé");
      qc.invalidateQueries({ queryKey: ["compta-audit-resume"] });
      qc.invalidateQueries({ queryKey: ["compta-audit-soldes"] });
      qc.invalidateQueries({ queryKey: ["compta-audit-factures"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const recalcAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recalculer_soldes_global_clients", {
        _motif: "Recalcul global page audit",
      });
      if (error) throw error;
      return data as { clients_traites: number };
    },
    onSuccess: (r) => {
      toast.success(`${r.clients_traites} client(s) recalculé(s)`);
      qc.invalidateQueries({ queryKey: ["compta-audit-resume"] });
      qc.invalidateQueries({ queryKey: ["compta-audit-soldes"] });
      qc.invalidateQueries({ queryKey: ["compta-audit-factures"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Accès réservé aux comptables et administrateurs.
      </div>
    );
  }

  const r = resumeQ.data;
  const factures = facturesQ.data ?? [];
  const soldes = soldesQ.data ?? [];
  const go = r?.verdict === "GO_PRODUCTION";
  const nbAnomalies = factures.length + soldes.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#3B82F6]" />
          <div>
            <h1 className="text-2xl font-bold">Audit Comptabilité &amp; Finances</h1>
            <p className="text-sm text-muted-foreground">
              Diagnostic en lecture seule — cohérence factures / paiements / soldes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resumeQ.refetch();
              facturesQ.refetch();
              soldesQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Relancer l'audit
          </Button>
          {canRecalcAll && nbAnomalies > 0 && (
            <Button
              onClick={() => {
                if (confirm(`Recalculer et corriger ${nbAnomalies} anomalie(s) ?`)) {
                  recalcAll.mutate();
                }
              }}
              disabled={recalcAll.isPending}
              style={{ background: "#EF4444", color: "#fff" }}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {recalcAll.isPending ? "Correction…" : "Tout recalculer"}
            </Button>
          )}
        </div>
      </div>

      {r && (
        <Card style={{ borderColor: go ? "#10B981" : "#EF4444", borderWidth: 2 }}>
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
              <Kpi label="Écritures" value={r.total_ecritures} />
              <Kpi label="Factures" value={r.total_factures} />
              <Kpi label="Paiements" value={r.total_paiements} />
              <Kpi
                label="Écritures déséquilibrées"
                value={r.ecritures_desequilibrees}
                danger={r.ecritures_desequilibrees > 0}
              />
              <Kpi
                label="Factures incohérentes"
                value={r.factures_incoherentes}
                danger={r.factures_incoherentes > 0}
              />
              <Kpi
                label="Soldes clients à corriger"
                value={r.soldes_clients_incoherents}
                danger={r.soldes_clients_incoherents > 0}
              />
              <Kpi
                label="Paiements orphelins"
                value={r.paiements_orphelins}
                danger={r.paiements_orphelins > 0}
              />
              <Kpi
                label="Doublons paiement"
                value={r.doublons_paiement}
                danger={r.doublons_paiement > 0}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Factures incohérentes ({factures.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead className="text-right">Payé enregistré</TableHead>
                  <TableHead className="text-right">Payé recalculé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Problème</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-[#10B981]">
                      Aucune anomalie sur les factures.
                    </TableCell>
                  </TableRow>
                ) : (
                  factures.map((f) => (
                    <TableRow key={f.facture_id}>
                      <TableCell className="font-medium">{f.reference}</TableCell>
                      <TableCell>{f.client_nom}</TableCell>
                      <TableCell className="text-right">{formatFCFA(f.montant_total)}</TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(f.montant_paye_enregistre)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(f.montant_paye_calcule)}
                      </TableCell>
                      <TableCell>{f.statut}</TableCell>
                      <TableCell>
                        <Badge style={{ background: "#EF4444", color: "#fff" }}>
                          {f.probleme}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soldes clients incohérents ({soldes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Solde enregistré</TableHead>
                  <TableHead className="text-right">Solde recalculé</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[#10B981]">
                      Aucun écart sur les soldes clients.
                    </TableCell>
                  </TableRow>
                ) : (
                  soldes.map((s) => (
                    <TableRow key={s.client_id}>
                      <TableCell className="font-medium">{s.reference}</TableCell>
                      <TableCell>{s.nom}</TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(s.solde_enregistre)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(s.solde_calcule)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge style={{ background: "#F97316", color: "#fff" }}>
                          {formatFCFA(s.ecart)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => recalcClient.mutate(s.client_id)}
                          disabled={recalcClient.isPending}
                        >
                          <Wrench className="mr-1 h-3 w-3" /> Corriger
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
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