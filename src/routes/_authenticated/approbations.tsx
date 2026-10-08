import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Inbox,
  Loader2,
  FileCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  Search,
  History,
  Download,
  UserPlus,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import { formatDistanceToNow, formatDistanceToNowStrict, isPast, differenceInMinutes, format } from "date-fns";
import { fr } from "date-fns/locale";


import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { Checkbox } from "@/components/ui/checkbox";


export const Route = createFileRoute("/_authenticated/approbations")({
  component: ApprobationsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Statut = "en_attente" | "approuve" | "rejete";

const TYPE_LABEL: Record<string, string> = {
  achat: "Achat",
  depense: "Dépense",
  conge: "Congé",
  mission: "Mission",
  facture: "Facture",
  retour: "Retour",
  paiement: "Paiement",
  frais_logistique: "Frais logistique",
  annulation: "Annulation",
  autre: "Autre",
};

const MODULE_OPTIONS = [
  { value: "all", label: "Tous les modules" },
  { value: "retour", label: "Retours clients" },
  { value: "paiement", label: "Paiements" },
  { value: "frais_logistique", label: "Frais logistique" },
  { value: "annulation", label: "Annulations" },
  { value: "achat", label: "Achats / Dépenses" },
  { value: "rh", label: "RH (Congés, Missions)" },
  { value: "autre", label: "Autre" },
];

const URGENCE_META: Record<string, { label: string; color: string }> = {
  critique: { label: "Critique", color: "#DC2626" },
  urgent: { label: "Urgent", color: "#F97316" },
  normal: { label: "Normal", color: "#64748B" },
};

const STATUT_META: Record<Statut, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#F97316" },
  approuve: { label: "Approuvée", color: "#10B981" },
  rejete: { label: "Rejetée", color: "#EF4444" },
};

type HistoriqueEntry = {
  at?: string;
  action?: string;
  by?: string;
  by_name?: string;
  commentaire?: string;
  [k: string]: unknown;
};

type Approval = {
  id: string;
  workflow_code: string | null;
  entity_type: string | null;
  entity_id: string | null;
  module: string | null;
  niveau_urgence: string | null;
  sla_deadline: string | null;
  reference: string | null;
  demandeur_nom: string | null;
  approbateur_nom: string | null;
  statut: string;
  commentaire: string | null;
  motif_refus: string | null;
  metadata: Record<string, unknown> | null;
  simulation_financiere: Record<string, unknown> | null;
  historique: HistoriqueEntry[] | null;
  decided_at: string | null;
  created_at: string;
};


function getMetaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" ? v : null;
}
function getMetaNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "number" ? v : null;
}

function deriveModule(row: Approval): string {
  if (row.module) return row.module;
  const key = row.entity_type ?? row.workflow_code ?? "";
  if (key === "retour") return "retour";
  if (key === "paiement") return "paiement";
  if (key === "frais_logistique" || key === "cout_logistique") return "frais_logistique";
  if (key === "annulation") return "annulation";
  if (key === "achat" || key === "depense") return "achat";
  if (key === "conge" || key === "mission") return "rh";
  return "autre";
}

function useApprovals(statut: Statut) {
  return useQuery({
    queryKey: ["approbations", "v2", statut],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_approvals")
        .select(
          "id, workflow_code, entity_type, entity_id, module, niveau_urgence, sla_deadline, reference, demandeur_nom, approbateur_nom, statut, commentaire, motif_refus, metadata, simulation_financiere, historique, decided_at, created_at",
        )
        .eq("statut", statut)
        .order("niveau_urgence", { ascending: true })
        .order("sla_deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Approval[];
    },
    staleTime: 30_000,
  });
}


function ApprobationsPage() {
  const [tab, setTab] = useState<Statut>("en_attente");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [urgenceFilter, setUrgenceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const badges: FilterBadge[] = [];
  if (moduleFilter !== "all")
    badges.push({
      key: "module",
      label: `Module : ${MODULE_OPTIONS.find((m) => m.value === moduleFilter)?.label ?? moduleFilter}`,
      onClear: () => setModuleFilter("all"),
    });
  if (urgenceFilter !== "all")
    badges.push({
      key: "urg",
      label: `Urgence : ${URGENCE_META[urgenceFilter]?.label ?? urgenceFilter}`,
      onClear: () => setUrgenceFilter("all"),
    });
  if (search.trim())
    badges.push({ key: "q", label: `Recherche : « ${search} »`, onClear: () => setSearch("") });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <FileCheck className="h-6 w-6" /> Centre d'approbations
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue transversale — retours clients, paiements, frais logistique, annulations et
            demandes internes.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/workflow-approvals">Gérer les demandes</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Référence, demandeur, objet…"
            className="pl-8"
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgenceFilter} onValueChange={setUrgenceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Urgence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes urgences</SelectItem>
            <SelectItem value="critique">Critique</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FilterBadges badges={badges} onResetAll={() => {
        setModuleFilter("all"); setUrgenceFilter("all"); setSearch("");
      }} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Statut)}>
        <TabsList>
          <TabsTrigger value="en_attente">En attente</TabsTrigger>
          <TabsTrigger value="approuve">Approuvées</TabsTrigger>
          <TabsTrigger value="rejete">Rejetées</TabsTrigger>
        </TabsList>
        {(["en_attente", "approuve", "rejete"] as Statut[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-4 space-y-4">
            <ApprovalsList
              statut={s}
              moduleFilter={moduleFilter}
              urgenceFilter={urgenceFilter}
              search={search}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ApprovalsList({
  statut,
  moduleFilter,
  urgenceFilter,
  search,
}: {
  statut: Statut;
  moduleFilter: string;
  urgenceFilter: string;
  search: string;
}) {
  const { data = [], isLoading } = useApprovals(statut);
  const qc = useQueryClient();
  const [escalading, setEscalading] = useState(false);
  const [dialog, setDialog] = useState<{ row: Approval; action: "approuve" | "rejete" } | null>(
    null,
  );
  const [timelineRow, setTimelineRow] = useState<Approval | null>(null);
  const [delegateRow, setDelegateRow] = useState<Approval | null>(null);
  const [bulkDialog, setBulkDialog] = useState<"approuve" | "rejete" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [approbateurQ, setApprobateurQ] = useState("");
  const isHistory = statut !== "en_attente";


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const appQ = approbateurQ.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return data.filter((r) => {
      if (moduleFilter !== "all" && deriveModule(r) !== moduleFilter) return false;
      if (urgenceFilter !== "all" && (r.niveau_urgence ?? "normal") !== urgenceFilter) return false;
      if (isHistory && appQ) {
        if (!(r.approbateur_nom ?? "").toLowerCase().includes(appQ)) return false;
      }
      if (isHistory && (from || to)) {
        const d = r.decided_at ? new Date(r.decided_at) : new Date(r.created_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (q) {
        const hay = [
          r.reference,
          r.demandeur_nom,
          r.approbateur_nom,
          r.workflow_code,
          r.entity_type,
          getMetaString(r.metadata, "objet"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, moduleFilter, urgenceFilter, search, approbateurQ, dateFrom, dateTo, isHistory]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const critiques = filtered.filter((r) => r.niveau_urgence === "critique").length;
    const slaDepasse = filtered.filter(
      (r) => r.sla_deadline && isPast(new Date(r.sla_deadline)),
    ).length;
    const montantTotal = filtered.reduce(
      (acc, r) => acc + (getMetaNumber(r.metadata, "montant") ?? 0),
      0,
    );
    const decided = filtered.filter((r) => r.decided_at);
    const delaiMoyenMin =
      decided.length > 0
        ? Math.round(
            decided.reduce(
              (acc, r) =>
                acc + differenceInMinutes(new Date(r.decided_at!), new Date(r.created_at)),
              0,
            ) / decided.length,
          )
        : 0;
    return { total, critiques, slaDepasse, montantTotal, delaiMoyenMin };
  }, [filtered]);

  const exportCsv = () => {
    const rows = [
      [
        "Référence",
        "Module",
        "Type",
        "Objet",
        "Demandeur",
        "Approbateur",
        "Statut",
        "Urgence",
        "Montant",
        "Créé le",
        "Décidé le",
        "Délai (min)",
        "Motif refus",
        "Commentaire",
      ],
      ...filtered.map((r) => [
        r.reference ?? r.id.slice(0, 8),
        deriveModule(r),
        r.entity_type ?? r.workflow_code ?? "",
        getMetaString(r.metadata, "objet") ?? "",
        r.demandeur_nom ?? "",
        r.approbateur_nom ?? "",
        r.statut,
        r.niveau_urgence ?? "normal",
        String(getMetaNumber(r.metadata, "montant") ?? ""),
        formatDateTime(r.created_at),
        r.decided_at ? formatDateTime(r.decided_at) : "",
        r.decided_at
          ? String(differenceInMinutes(new Date(r.decided_at), new Date(r.created_at)))
          : "",
        r.motif_refus ?? "",
        (r.commentaire ?? "").replace(/\r?\n/g, " "),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "");
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `approbations-${statut}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <>
      {isHistory && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Décidé du</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">au</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Approbateur</label>
            <Input
              value={approbateurQ}
              onChange={(e) => setApprobateurQ(e.target.value)}
              placeholder="Nom approbateur…"
              className="w-[200px]"
            />
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Exporter CSV
            </Button>
          </div>
        </div>
      )}

      {statut === "en_attente" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="À traiter" value={kpis.total.toString()} />
            <KpiCard
              label="Critiques"
              value={kpis.critiques.toString()}
              color={kpis.critiques > 0 ? "#DC2626" : undefined}
            />
            <KpiCard
              label="SLA dépassé"
              value={kpis.slaDepasse.toString()}
              color={kpis.slaDepasse > 0 ? "#F97316" : undefined}
            />
            <KpiCard label="Montant cumulé" value={formatFCFA(kpis.montantTotal)} />
          </div>
          {kpis.slaDepasse > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span>
                {kpis.slaDepasse} demande{kpis.slaDepasse > 1 ? "s" : ""} au-delà du délai
                d&apos;approbation.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={escalading}
                onClick={async () => {
                  setEscalading(true);
                  const { data, error } = await supabase.rpc("approbation_escalader_sla");
                  setEscalading(false);
                  if (error) {
                    toast.error(friendlyError(error));
                    return;
                  }
                  const n = (data as { escalades?: number } | null)?.escalades ?? 0;
                  toast.success(
                    n > 0
                      ? `${n} demande(s) escaladée(s) vers la Direction.`
                      : "Aucune nouvelle demande à escalader.",
                  );
                  qc.invalidateQueries({ queryKey: ["approbations"] });
                }}
              >
                {escalading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-1.5" />
                )}
                Escalader vers la Direction
              </Button>
            </div>
          )}
        </div>
      )}

      {isHistory && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={kpis.total.toString()} />
          <KpiCard
            label="Délai moyen"
            value={
              kpis.delaiMoyenMin < 60
                ? `${kpis.delaiMoyenMin} min`
                : `${Math.round(kpis.delaiMoyenMin / 60)} h`
            }
          />
          <KpiCard label="Montant cumulé" value={formatFCFA(kpis.montantTotal)} />
          <KpiCard
            label="Export"
            value={`${filtered.length} ligne${filtered.length > 1 ? "s" : ""}`}
          />
        </div>
      )}

      {!isHistory && filtered.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-1">
          <Checkbox
            checked={selected.size > 0 && selected.size === filtered.length}
            onCheckedChange={(v) => {
              if (v) setSelected(new Set(filtered.map((r) => r.id)));
              else setSelected(new Set());
            }}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} sélectionnée${selected.size > 1 ? "s" : ""}`
              : "Tout sélectionner"}
          </span>
          {selected.size > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => setBulkDialog("rejete")}>
                <XCircle className="h-4 w-4 mr-1.5" /> Rejeter en lot
              </Button>
              <Button size="sm" onClick={() => setBulkDialog("approuve")}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approuver en lot
              </Button>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            <p className="text-sm">Aucune demande dans cette catégorie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <ApprovalCard
              key={row.id}
              row={row}
              selected={selected.has(row.id)}
              onToggleSelect={
                !isHistory
                  ? () => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      });
                    }
                  : undefined
              }
              onAction={(action) => setDialog({ row, action })}
              onTimeline={() => setTimelineRow(row)}
              onDelegate={() => setDelegateRow(row)}
            />
          ))}
        </div>
      )}

      {dialog && (
        <DecisionDialog row={dialog.row} action={dialog.action} onClose={() => setDialog(null)} />
      )}
      {timelineRow && (
        <TimelineDialog row={timelineRow} onClose={() => setTimelineRow(null)} />
      )}
      {delegateRow && (
        <DelegateDialog row={delegateRow} onClose={() => setDelegateRow(null)} />
      )}
      {bulkDialog && (
        <BulkDecisionDialog
          ids={Array.from(selected)}
          action={bulkDialog}
          onClose={(done) => {
            setBulkDialog(null);
            if (done) {
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["approbations"] });
            }
          }}
        />
      )}
    </>
  );
}



function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold" style={color ? { color } : undefined}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ApprovalCard({
  row,
  selected,
  onToggleSelect,
  onAction,
  onTimeline,
  onDelegate,
}: {
  row: Approval;
  selected?: boolean;
  onToggleSelect?: () => void;
  onAction: (action: "approuve" | "rejete") => void;
  onTimeline: () => void;
  onDelegate?: () => void;
}) {

  const navigate = useNavigate();
  const meta = STATUT_META[row.statut as Statut] ?? STATUT_META.en_attente;
  const isPending = row.statut === "en_attente";
  const mod = deriveModule(row);
  const typeKey = row.entity_type ?? row.workflow_code ?? "autre";
  const objet = getMetaString(row.metadata, "objet");
  const montant = getMetaNumber(row.metadata, "montant");
  const urg = URGENCE_META[row.niveau_urgence ?? "normal"] ?? URGENCE_META.normal;
  const slaOver = row.sla_deadline ? isPast(new Date(row.sla_deadline)) : false;
  const delegataire = getMetaString(row.metadata, "delegataire_nom");
  const delegueParNom = getMetaString(row.metadata, "delegue_par");

  const openDetail = () => {
    if (mod === "retour" && row.entity_id) {
      navigate({ to: "/retours/$retourId", params: { retourId: row.entity_id } });
    }
  };

  const canOpenDetail = mod === "retour" && !!row.entity_id;


  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {onToggleSelect && isPending && (
            <div className="pt-1">
              <Checkbox checked={!!selected} onCheckedChange={onToggleSelect} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{TYPE_LABEL[typeKey] ?? typeKey}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {row.reference ?? row.id.slice(0, 8)}
              </span>
              <Badge style={{ background: meta.color, color: "white" }}>{meta.label}</Badge>
              {delegataire && (
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" /> Délégué à {delegataire}
                  {delegueParNom ? ` (par ${delegueParNom})` : ""}
                </Badge>
              )}

              {row.niveau_urgence && row.niveau_urgence !== "normal" && (
                <Badge style={{ background: urg.color, color: "white" }} className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {urg.label}
                </Badge>
              )}
              {row.sla_deadline && (
                <Badge
                  variant={slaOver ? "destructive" : "secondary"}
                  className="gap-1"
                  title={new Date(row.sla_deadline).toLocaleString("fr-FR")}
                >
                  <Clock className="h-3 w-3" />
                  {slaOver ? "SLA dépassé " : "SLA "}
                  {formatDistanceToNowStrict(new Date(row.sla_deadline), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </Badge>
              )}
            </div>
            <p className="font-medium mt-2">{objet || "—"}</p>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
              <span>Demandeur : {row.demandeur_nom ?? "—"}</span>
              {montant != null && montant > 0 && (
                <span className="font-semibold text-foreground">{formatFCFA(montant)}</span>
              )}
              <span>
                {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: fr })}
              </span>
            </div>
            {row.motif_refus && (
              <p className="text-xs text-destructive mt-2 border-l-2 border-destructive pl-2 italic">
                Motif refus : {row.motif_refus}
              </p>
            )}
            {!row.motif_refus && row.commentaire && (
              <p className="text-xs text-muted-foreground mt-2 border-l-2 pl-2 italic whitespace-pre-line">
                {row.commentaire}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={onTimeline}>
              <History className="h-4 w-4 mr-1.5" /> Historique
            </Button>
            {isPending && onDelegate && (
              <Button size="sm" variant="ghost" onClick={onDelegate}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Déléguer
              </Button>
            )}
            {canOpenDetail && (
              <Button size="sm" variant="outline" onClick={openDetail}>
                <ExternalLink className="h-4 w-4 mr-1.5" /> Ouvrir la fiche
              </Button>
            )}
            {isPending && !canOpenDetail && (
              <>
                <Button size="sm" variant="outline" onClick={() => onAction("rejete")}>
                  <XCircle className="h-4 w-4 mr-1.5" /> Rejeter
                </Button>
                <Button size="sm" onClick={() => onAction("approuve")}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approuver
                </Button>
              </>
            )}
          </div>


        </div>
      </CardContent>
    </Card>
  );
}

function DecisionDialog({
  row,
  action,
  onClose,
}: {
  row: Approval;
  action: "approuve" | "rejete";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const isApprove = action === "approuve";
  const meta = STATUT_META[action];
  const actorName =
    (user?.user_metadata?.nom_complet as string | undefined) || user?.email || "Système";
  const typeKey = row.entity_type ?? row.workflow_code ?? "autre";
  const objet = getMetaString(row.metadata, "objet");
  const montant = getMetaNumber(row.metadata, "montant");

  const submit = async () => {
    try {
      setBusy(true);
      const decisionNote = `[${isApprove ? "Approuvée" : "Rejetée"} par ${actorName}${
        comment ? ` — ${comment}` : ""
      }]`;

      const { data: result, error } = await supabase.rpc("approbation_decider", {
        p_approbation_id: row.id,
        p_decision: isApprove ? "approuve" : "rejete",
        p_commentaire: comment || undefined,
      });

      if (error) throw error;

      toast.success(
        `Demande ${isApprove ? "approuvée" : "rejetée"} — impact appliqué au module ${row.module ?? typeKey}`,
      );
      qc.invalidateQueries({ queryKey: ["approbations"] });
      qc.invalidateQueries({ queryKey: ["paiements"] });
      qc.invalidateQueries({ queryKey: ["commandes"] });
      qc.invalidateQueries({ queryKey: ["couts_logistiques"] });
      qc.invalidateQueries({ queryKey: ["retours"] });
      qc.invalidateQueries({ queryKey: ["retour"] });
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approuver" : "Rejeter"} la demande {row.reference ?? row.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Type :</span>{" "}
              {TYPE_LABEL[typeKey] ?? typeKey}
            </p>
            <p>
              <span className="text-muted-foreground">Demandeur :</span> {row.demandeur_nom ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Objet :</span> {objet || "—"}
            </p>
            {montant != null && montant > 0 && (
              <p>
                <span className="text-muted-foreground">Montant :</span> {formatFCFA(montant)}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">
              Commentaire {isApprove ? "(optionnel)" : "(recommandé)"}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isApprove ? "Motif d'approbation…" : "Motif de rejet…"}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            style={{ background: meta.color, color: "white" }}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer {isApprove ? "l'approbation" : "le rejet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimelineDialog({ row, onClose }: { row: Approval; onClose: () => void }) {
  const entries: HistoriqueEntry[] = Array.isArray(row.historique) ? row.historique : [];
  const objet = getMetaString(row.metadata, "objet");
  const typeKey = row.entity_type ?? row.workflow_code ?? "autre";

  const events: HistoriqueEntry[] = [
    { at: row.created_at, action: "cree", by_name: row.demandeur_nom ?? undefined },
    ...entries,
  ];
  if (row.decided_at && !entries.some((e) => e.action === row.statut)) {
    events.push({
      at: row.decided_at,
      action: row.statut,
      by_name: row.approbateur_nom ?? undefined,
      commentaire: row.motif_refus ?? row.commentaire ?? undefined,
    });
  }
  events.sort(
    (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
  );

  const actionLabel = (a?: string) => {
    switch (a) {
      case "cree":
        return "Demande créée";
      case "approuve":
      case "approuvee":
        return "Approuvée";
      case "rejete":
      case "rejetee":
        return "Rejetée";
      case "commentaire":
        return "Commentaire";
      case "escalade":
        return "Escaladée";
      default:
        return a ?? "Événement";
    }
  };
  const actionColor = (a?: string) => {
    if (a === "approuve" || a === "approuvee") return "#10B981";
    if (a === "rejete" || a === "rejetee") return "#EF4444";
    if (a === "cree") return "#3B82F6";
    return "#64748B";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique — {row.reference ?? row.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/30">
            <p>
              <span className="text-muted-foreground">Type :</span>{" "}
              {TYPE_LABEL[typeKey] ?? typeKey}
            </p>
            {objet && (
              <p>
                <span className="text-muted-foreground">Objet :</span> {objet}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Statut :</span> {row.statut}
            </p>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun événement enregistré.
              </p>
            ) : (
              events.map((e, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="h-3 w-3 rounded-full mt-1.5"
                      style={{ background: actionColor(e.action) }}
                    />
                    {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{actionLabel(e.action)}</span>
                      {e.by_name && (
                        <span className="text-xs text-muted-foreground">par {e.by_name}</span>
                      )}
                    </div>
                    {e.at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    )}
                    {e.commentaire && (
                      <p className="text-xs mt-1 border-l-2 pl-2 italic whitespace-pre-line">
                        {e.commentaire}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDecisionDialog({
  ids,
  action,
  onClose,
}: {
  ids: string[];
  action: "approuve" | "rejete";
  onClose: (done: boolean) => void;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const isApprove = action === "approuve";
  const meta = STATUT_META[action];

  const submit = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc("approbation_decider_lot", {
        p_ids: ids,
        p_decision: action,
        p_commentaire: comment || undefined,
      });
      if (error) throw error;
      const res = (data ?? {}) as { ok?: number; ko?: number };
      const ok = res.ok ?? 0;
      const ko = res.ko ?? 0;
      if (ko > 0) {
        toast.warning(`${ok} traitée${ok > 1 ? "s" : ""}, ${ko} en erreur.`);
      } else {
        toast.success(`${ok} demande${ok > 1 ? "s" : ""} ${isApprove ? "approuvée" : "rejetée"}${ok > 1 ? "s" : ""}.`);
      }
      onClose(true);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approuver" : "Rejeter"} {ids.length} demande{ids.length > 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Chaque demande sera traitée individuellement avec ses impacts métier. Un rapport détaillera les éventuelles erreurs.
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">
              Commentaire {isApprove ? "(optionnel)" : "(recommandé)"}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isApprove ? "Motif d'approbation…" : "Motif de rejet…"}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            style={{ background: meta.color, color: "white" }}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer ({ids.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DelegateDialog({ row, onClose }: { row: Approval; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [delegataireId, setDelegataireId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: approbateurs = [] } = useQuery({
    queryKey: ["approbateurs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom_complet, email")
        .neq("id", user?.id ?? "")
        .order("nom_complet", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const submit = async () => {
    if (!delegataireId) {
      toast.error("Choisir un délégataire");
      return;
    }
    try {
      setBusy(true);
      const { error } = await supabase.rpc("approbation_deleguer", {
        p_approbation_id: row.id,
        p_delegataire_id: delegataireId,
        p_commentaire: comment || undefined,
        p_expire_at: expireAt ? new Date(expireAt).toISOString() : undefined,
      });
      if (error) throw error;
      toast.success("Demande déléguée");
      qc.invalidateQueries({ queryKey: ["approbations"] });
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Déléguer la demande
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Demande</p>
            <p className="font-medium">
              {row.reference ?? row.id.slice(0, 8)} — {getMetaString(row.metadata, "objet") ?? "—"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Déléguer à</label>
            <Select value={delegataireId} onValueChange={setDelegataireId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un utilisateur…" />
              </SelectTrigger>
              <SelectContent>
                {approbateurs.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nom_complet || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Expire le (optionnel)</label>
            <Input
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Commentaire (optionnel)</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Contexte de la délégation…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy || !delegataireId}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Déléguer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
