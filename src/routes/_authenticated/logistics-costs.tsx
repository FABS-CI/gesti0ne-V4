import { createFileRoute, Link } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  DollarSign,
  Eye,
  FileDown,
  Filter,
  Undo2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportListePDF } from "@/lib/pdf/exportListe";
import {
  CATEGORIES,
  TYPES,
  VALIDATION_STATUTS,
  fmtFCFA,
  startOf,
  statutMeta,
  type TourneeCout,
} from "@/components/logistics-costs/types";
import { Kpi } from "@/components/logistics-costs/Kpi";
import { DetailDialog } from "@/components/logistics-costs/DetailDialog";
import { ValidateDialog } from "@/components/logistics-costs/ValidateDialog";
import { RefuseDialog } from "@/components/logistics-costs/RefuseDialog";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/logistics-costs")({
  component: LogisticsCostsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function LogisticsCostsPage() {
  const qc = useQueryClient();
  const { has, isSuperAdmin } = usePermissions();
  const canCancel = isSuperAdmin || has("tournees.annuler_validation");


  const [f, setF] = useState({
    from: "",
    to: "",
    chauffeur: "",
    responsable: "",
    vehicule: "all",
    statut: "all",
    type: "all",
  });

  const vehQ = useQuery({
    queryKey: ["logistics-vehicules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicules")
        .select("vehicule_id, immatriculation")
        .order("immatriculation");
      return (data ?? []) as Array<{ vehicule_id: string; immatriculation: string | null }>;
    },
  });

  const listQ = useQuery({
    queryKey: ["logistics-costs", f],
    queryFn: async (): Promise<TourneeCout[]> => {
      let q = supabase
        .from("tournees")
        .select(
          "tournee_id, reference, date_tournee, chauffeur_nom, responsable_nom, vehicule_id, vehicules:vehicule_id(immatriculation), statut, type_tournee, validation_statut, mode_reglement, validation_at, validation_commentaire, nb_clients, nb_colis, nb_cartons, cout_carburant, cout_peages, cout_repas, cout_manutentions, cout_livraison, cout_expeditions, cout_autres, cout_total, ecriture_id",
        )
        .gt("cout_total", 0)
        .order("date_tournee", { ascending: false, nullsFirst: false });
      if (f.from) q = q.gte("date_tournee", f.from);
      if (f.to) q = q.lte("date_tournee", f.to);
      if (f.chauffeur) q = q.ilike("chauffeur_nom", `%${f.chauffeur}%`);
      if (f.responsable) q = q.ilike("responsable_nom", `%${f.responsable}%`);
      if (f.vehicule !== "all") q = q.eq("vehicule_id", f.vehicule);
      if (f.statut !== "all") q = q.eq("validation_statut", f.statut);
      if (f.type !== "all") q = q.eq("type_tournee", f.type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TourneeCout[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("logistics-costs-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournees" }, () =>
        qc.invalidateQueries({ queryKey: ["logistics-costs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = listQ.data ?? [];

  const kpis = useMemo(() => {
    const now = new Date();
    const day = startOf("day");
    const week = startOf("week");
    const month = startOf("month");
    const year = startOf("year");
    let tDay = 0,
      tWeek = 0,
      tMonth = 0,
      tYear = 0;
    const byCat: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
    let sumClients = 0,
      sumColis = 0,
      sumCartons = 0,
      sumTotal = 0;
    for (const r of rows) {
      const dt = r.date_tournee ? new Date(r.date_tournee) : null;
      const total = Number(r.cout_total ?? 0);
      sumTotal += total;
      sumClients += r.nb_clients ?? 0;
      sumColis += r.nb_colis ?? 0;
      sumCartons += r.nb_cartons ?? 0;
      for (const c of CATEGORIES) byCat[c.key] += Number(r[c.key] ?? 0);
      if (!dt) continue;
      if (dt >= day && dt <= now) tDay += total;
      if (dt >= week) tWeek += total;
      if (dt >= month) tMonth += total;
      if (dt >= year) tYear += total;
    }
    const n = rows.length || 1;
    return {
      tDay,
      tWeek,
      tMonth,
      tYear,
      moyTournee: sumTotal / n,
      moyClient: sumClients ? sumTotal / sumClients : 0,
      moyColis: sumColis ? sumTotal / sumColis : 0,
      moyCarton: sumCartons ? sumTotal / sumCartons : 0,
      byCat,
      sumTotal,
    };
  }, [rows]);

  const [validating, setValidating] = useState<TourneeCout | null>(null);
  const [refusing, setRefusing] = useState<TourneeCout | null>(null);
  const [detail, setDetail] = useState<TourneeCout | null>(null);

  const exportPdf = () => {
    exportListePDF({
      titre: "Coûts logistiques — Récapitulatif",
      filtres: [
        f.from ? `Du ${f.from}` : "Depuis le début",
        f.to ? `au ${f.to}` : "à ce jour",
        f.statut !== "all" ? `Statut : ${statutMeta(f.statut).label}` : "Tous statuts",
        f.type !== "all" ? `Type : ${f.type}` : "Tous types",
      ],
      colonnes: [
        "Tournée",
        "Date",
        "Chauffeur",
        "Véhicule",
        "Type",
        "Colis",
        "Cartons",
        "Total FCFA",
        "Statut",
      ],
      lignes: rows.map((r) => [
        r.reference,
        r.date_tournee ?? "—",
        r.chauffeur_nom ?? "—",
        r.vehicules?.immatriculation ?? "—",
        r.type_tournee ?? "—",
        r.nb_colis,
        r.nb_cartons,
        formatFCFA(Math.round(Number(r.cout_total ?? 0)), false),
        statutMeta(r.validation_statut).label,
      ]),
      recap: [
        { label: "Nombre de tournées", valeur: String(rows.length) },
        { label: "Total période", valeur: fmtFCFA(kpis.sumTotal) },
        { label: "Total mois", valeur: fmtFCFA(kpis.tMonth) },
        { label: "Moyenne / tournée", valeur: fmtFCFA(kpis.moyTournee) },
      ],
      filename: "couts-logistiques",
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Coûts logistiques
          </h1>
          <p className="text-sm text-muted-foreground">
            Consultation, validation comptable et suivi des dépenses des tournées.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={!rows.length}>
          <FileDown className="mr-2 h-4 w-4" /> Rapport PDF
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi label="Aujourd'hui" value={fmtFCFA(kpis.tDay)} />
        <Kpi label="Semaine" value={fmtFCFA(kpis.tWeek)} />
        <Kpi label="Mois" value={fmtFCFA(kpis.tMonth)} />
        <Kpi label="Année" value={fmtFCFA(kpis.tYear)} />
        <Kpi label="Moyenne / tournée" value={fmtFCFA(kpis.moyTournee)} />
        <Kpi label="Moyenne / client" value={fmtFCFA(kpis.moyClient)} />
        <Kpi label="Moyenne / colis" value={fmtFCFA(kpis.moyColis)} />
        <Kpi label="Moyenne / carton" value={fmtFCFA(kpis.moyCarton)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Répartition des dépenses par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map((c) => {
              const v = kpis.byCat[c.key] ?? 0;
              const pct = kpis.sumTotal ? Math.round((v / kpis.sumTotal) * 100) : 0;
              return (
                <div key={String(c.key)} className="rounded border p-2 text-xs">
                  <div className="text-muted-foreground">{c.label}</div>
                  <div className="font-semibold tabular-nums">{fmtFCFA(v)}</div>
                  <div className="text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <div>
            <label className="text-xs text-muted-foreground">Du</label>
            <Input
              type="date"
              value={f.from}
              onChange={(e) => setF({ ...f, from: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Au</label>
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Chauffeur</label>
            <Input
              value={f.chauffeur}
              onChange={(e) => setF({ ...f, chauffeur: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Responsable</label>
            <Input
              value={f.responsable}
              onChange={(e) => setF({ ...f, responsable: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Véhicule</label>
            <Select value={f.vehicule} onValueChange={(v) => setF({ ...f, vehicule: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(vehQ.data ?? []).map((v) => (
                  <SelectItem key={v.vehicule_id} value={v.vehicule_id}>
                    {v.immatriculation ?? v.vehicule_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Statut</label>
            <Select value={f.statut} onValueChange={(v) => setF({ ...f, statut: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {VALIDATION_STATUTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tournées avec coûts ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="border p-2">Tournée</th>
                <th className="border p-2">Date</th>
                <th className="border p-2">Chauffeur</th>
                <th className="border p-2">Véhicule</th>
                <th className="border p-2">Type</th>
                <th className="border p-2 text-right">Clients</th>
                <th className="border p-2 text-right">Colis</th>
                <th className="border p-2 text-right">Cartons</th>
                <th className="border p-2 text-right">Total FCFA</th>
                <th className="border p-2">Statut</th>
                <th className="border p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="border p-4 text-center text-muted-foreground">
                    {listQ.isLoading ? "Chargement…" : "Aucun coût enregistré."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const meta = statutMeta(r.validation_statut);
                  return (
                    <tr key={r.tournee_id} className="hover:bg-muted/20">
                      <td className="border p-2 font-mono">{r.reference}</td>
                      <td className="border p-2">{r.date_tournee ?? "—"}</td>
                      <td className="border p-2">{r.chauffeur_nom ?? "—"}</td>
                      <td className="border p-2">{r.vehicules?.immatriculation ?? "—"}</td>
                      <td className="border p-2 capitalize">{r.type_tournee ?? "—"}</td>
                      <td className="border p-2 text-right tabular-nums">{r.nb_clients}</td>
                      <td className="border p-2 text-right tabular-nums">{r.nb_colis}</td>
                      <td className="border p-2 text-right tabular-nums">{r.nb_cartons}</td>
                      <td className="border p-2 text-right tabular-nums font-semibold">
                        {formatFCFA(Math.round(Number(r.cout_total ?? 0)), false)}
                      </td>
                      <td className="border p-2">
                        <Badge variant="outline" className={`text-${meta.color}-700`}>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="border p-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button aria-label="Voir la tournée" asChild variant="ghost" size="icon" title="Ouvrir le bon de tournée">
                            <Link to="/bon-de-tournee/$tourneeId" params={{ tourneeId: r.tournee_id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>

                          <Button aria-label="Détail des coûts"
                            variant="ghost"
                            size="icon"
                            title="Détail des coûts"
                            onClick={() => setDetail(r)}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {(r.validation_statut === "en_attente" || r.validation_statut === "brouillon") && (
                            <>
                              <Button aria-label="Valider le décaissement"
                                variant="default"
                                size="sm"
                                title="Valider le décaissement"
                                onClick={() => setValidating(r)}
                                className="gap-1"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Valider
                              </Button>
                              {(isSuperAdmin || has("tournees.valider_couts")) && (
                                <Button aria-label="Refuser"
                                  variant="ghost"
                                  size="icon"
                                  title="Refuser"
                                  onClick={() => setRefusing(r)}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </>
                          )}
                          {canCancel && r.validation_statut === "decaisse" && (
                            <Button aria-label="Annuler la validation"
                              variant="ghost"
                              size="icon"
                              title="Annuler la validation"
                              onClick={async () => {
                                if (!confirm("Annuler la validation et supprimer l'écriture ?"))
                                  return;
                                const { error } = await supabase.rpc("annuler_validation_tournee", {
                                  _tournee_id: r.tournee_id,
                                  _commentaire: undefined,
                                });
                                if (error) toast.error(friendlyError(error));
                                else {
                                  toast.success("Validation annulée");
                                  qc.invalidateQueries({ queryKey: ["logistics-costs"] });
                                }
                              }}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ValidateDialog
        row={validating}
        onClose={() => setValidating(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["logistics-costs"] })}
      />
      <RefuseDialog
        row={refusing}
        onClose={() => setRefusing(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["logistics-costs"] })}
      />
      <DetailDialog row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
