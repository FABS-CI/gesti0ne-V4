import { PageHeader } from "@/components/common/PageHeader";
import { formatDocumentReference } from "@/lib/document-reference";
import { ClientLink } from "@/components/common/ClientLink";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileDown, FileText, Search, RotateCcw, X, Package, SlidersHorizontal } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import { usePdfDownload } from "@/hooks/use-pdf-download";
import {
  AdvancedSearchBar,
  describeFilters,
  type AdvancedFilters,
} from "@/components/search/AdvancedSearchBar";
import { exportListePDF } from "@/lib/pdf/exportListe";
import {
  listFacturesPaginated,
  STATUTS_FACTURE,
  STATUT_FACTURE_LABEL,
  getRetoursByFactureIds,
  computeRetourResume,
  RETOUR_STATUS_META,
} from "@/lib/factures-api";
import { supabase } from "@/integrations/supabase/client";
import { FneRowActions } from "@/components/fne/FneRowActions";
import { EmptyState } from "@/components/common/EmptyState";
import type { FNEStatus } from "@/lib/fne-api";

import { formatFCFA, formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FacturesKpis } from "@/components/factures/list/FacturesKpis";
import { StatusPill } from "@/components/common/StatusPill";
import { RowActionsMenu } from "@/components/common/list/RowActionsMenu";
import {
  ListCard,
  ListFilterBar,
  ListPageHeader,
  ListPagination,
  ListSkeletonRows,
  ListStatusTabs,
} from "@/components/common/list/ListParts";
import { FACTURE_STATUT_TONE } from "@/lib/statut-tone";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FneStatusBadge } from "@/components/factures/list/FneStatusBadge";
import { FacturePdfActions } from "@/components/factures/list/FacturePdfActions";
import { SkeletonTable, SkeletonKpiRow } from "@/components/ui/skeletons";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/factures/")({
  head: () => authRouteHead("Factures"),
  pendingMs: 200,
  pendingComponent: FacturesPending,
  component: FacturesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function FacturesPending() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-48 animate-pulse rounded bg-muted" />
      <SkeletonKpiRow count={4} />
      <div className="rounded-lg border p-4">
        <SkeletonTable rows={10} cols={7} />
      </div>
    </div>
  );
}

function FacturesPage() {
  const pdf = usePdfDownload();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const q = useDebouncedValue(search, 300);
  const [advanced, setAdvanced] = useState<AdvancedFilters>({});
  const exerciceId = useExerciceConsulteId();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const PAGE_SIZE = 50;

  const advancedChips = describeFilters(advanced);
  const hasActiveFilters =
    !!q || statutFilter !== "all" || advancedChips.length > 0;
  function resetAllFilters() {
    setSearch("");
    setStatutFilter("all");
    setAdvanced({});
  }

  // Reset page when filters change
  useMemo(() => setPage(1), [q, statutFilter, advanced, exerciceId]);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["factures-paginated", exerciceId, q, statutFilter, advanced, page, PAGE_SIZE],
    enabled: !!exerciceId,
    queryFn: () =>
      listFacturesPaginated({
        q,
        statut: statutFilter === "all" ? undefined : statutFilter,
        exerciceId,
        adv: {
          reference: advanced.reference,
          client: advanced.client,
          telephone: advanced.telephone,
          commercial: advanced.commercial,
          ville: advanced.ville,
          commande: advanced.commande,
          dateDu: advanced.dateDu,
          dateAu: advanced.dateAu,
          montantMin: advanced.montantMin,
          montantMax: advanced.montantMax,
        },
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });
  const factures = pageData?.items ?? [];
  const totalCount = pageData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const today = new Date().toISOString().slice(0, 10);

  // Nombre de factures par statut, avec les mêmes filtres (onglets).
  const advParams = {
    reference: advanced.reference,
    client: advanced.client,
    telephone: advanced.telephone,
    commercial: advanced.commercial,
    ville: advanced.ville,
    commande: advanced.commande,
    dateDu: advanced.dateDu,
    dateAu: advanced.dateAu,
    montantMin: advanced.montantMin,
    montantMax: advanced.montantMax,
  };
  const { data: statutCounts } = useQuery({
    queryKey: ["factures-statut-counts", exerciceId, q, advanced],
    enabled: !!exerciceId,
    staleTime: 30_000,
    queryFn: async () => {
      const keys = ["all", ...STATUTS_FACTURE.map((s) => s.value)];
      const res = await Promise.all(
        keys.map((k) =>
          listFacturesPaginated({
            q,
            statut: k === "all" ? undefined : k,
            exerciceId,
            adv: advParams,
            page: 1,
            pageSize: 1,
          }),
        ),
      );
      return Object.fromEntries(keys.map((k, i) => [k, res[i].totalCount])) as Record<string, number>;
    },
  });

  // Reste dû des factures dont l'échéance est dépassée (exercice consulté).
  const { data: retardTotal = 0 } = useQuery({
    queryKey: ["factures-retard-total", exerciceId, today],
    enabled: !!exerciceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("montant_total, montant_paye")
        .eq("exercice_id", exerciceId!)
        .lt("date_echeance", today)
        .in("statut", ["impayee", "partielle"]);
      if (error) throw error;
      return (data ?? []).reduce(
        (a, r) => a + Math.max(0, Number(r.montant_total ?? 0) - Number(r.montant_paye ?? 0)),
        0,
      );
    },
  });

  const factureIds = factures.map((f) => f.facture_id);
  const { data: fneMap = {} } = useQuery({
    queryKey: ["fne-by-factures", factureIds.join(",")],
    enabled: factureIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("fne_factures")
        .select("facture_id, statut, fne_id, code_dgi")
        .in("facture_id", factureIds);
      const m: Record<string, { statut: string; fne_id: string; code_dgi: string | null }> = {};
      for (const r of data ?? []) {
        if (r.facture_id)
          m[r.facture_id as string] = {
            statut: r.statut as string,
            fne_id: r.fne_id as string,
            code_dgi: r.code_dgi as string | null,
          };
      }
      return m;
    },
  });

  const { data: retoursMap = {} } = useQuery({
    queryKey: ["retours-by-factures", factureIds.join(",")],
    enabled: factureIds.length > 0,
    queryFn: () => getRetoursByFactureIds(factureIds),
  });

  // Totaux calculés côté base (KPI cohérents avec tous les filtres, pas juste la page)
  const totals = useMemo(() => {
    const total = pageData?.sumMontantTotal ?? 0;
    const paye = pageData?.sumMontantPaye ?? 0;
    return { total, paye, du: total - paye };
  }, [pageData]);

  function handleExport() {
    exportCsv(
      "factures.csv",
      ["Référence", "Date", "Échéance", "Client", "Total", "Payé", "Reste", "Statut"],
      factures.map((f) => [
        f.reference,
        f.date_facture,
        f.date_echeance ?? "",
        f.client_nom ?? "",
        String(f.montant_total),
        String(f.montant_paye),
        String(Number(f.montant_total) - Number(f.montant_paye)),
        STATUT_FACTURE_LABEL[f.statut]?.label ?? f.statut,
      ]),
      {
        pageTitle: "LISTE DES FACTURES",
        summary: [
          { label: "Nombre de factures", value: String(factures.length) },
          {
            label: "Factures annulées",
            value: String(factures.filter((f) => f.statut === "annulee").length),
          },
          { label: "Total facturé", value: formatFCFA(totals.total) },
          { label: "Total encaissé", value: formatFCFA(totals.paye) },
          { label: "Reste à recouvrer", value: formatFCFA(totals.du) },
        ],
      },
    );
  }

  function handleExportPDF() {
    const filtres: string[] = [];
    if (q) filtres.push(`Recherche : ${q}`);
    if (statutFilter !== "all")
      filtres.push(`Statut : ${STATUT_FACTURE_LABEL[statutFilter]?.label ?? statutFilter}`);
    filtres.push(...describeFilters(advanced));
    exportListePDF({
      titre: "Liste des factures",
      colonnes: [
        "Référence",
        "Date",
        "Client",
        "Total (FCFA)",
        "Payé (FCFA)",
        "Reste (FCFA)",
        "Statut",
      ],
      lignes: factures.map((f) => [
        f.reference,
        f.date_facture,
        f.client_nom ?? "",
        formatFCFA(Number(f.montant_total), false),
        formatFCFA(Number(f.montant_paye), false),
        formatFCFA((Number(f.montant_total) - Number(f.montant_paye)), false),
        STATUT_FACTURE_LABEL[f.statut]?.label ?? f.statut,
      ]),
      filtres,
      filename: "factures",
    });
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        overline="Ventes"
        title="Factures"
        description="Les factures sont générées automatiquement à la validation d'une commande"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!factures.length}>
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleExport}>
                  <Download className="mr-2 h-4 w-4" /> Excel / CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportPDF}>
                  <FileDown className="mr-2 h-4 w-4" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link to="/commandes/nouvelle">Nouvelle facture</Link>
            </Button>
          </>
        }
      />

      <FacturesKpis {...totals} retard={retardTotal} />

      <ListCard>
        <ListStatusTabs
          value={statutFilter}
          onChange={setStatutFilter}
          tabs={[
            { value: "all", label: "Toutes", count: statutCounts?.all },
            ...STATUTS_FACTURE.map((s) => ({
              value: s.value,
              label: s.label,
              count: statutCounts?.[s.value],
            })),
          ]}
        />
        <ListFilterBar>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="N° de facture ou client"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={filtersOpen ? "secondary" : "outline"}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Client, période, représentant
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={resetAllFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Réinitialiser
            </Button>
          )}
        </ListFilterBar>

        {filtersOpen && (
          <div className="border-b px-4 py-3">
            <AdvancedSearchBar
              fields={[
                "reference",
                "commande",
                "client",
                "telephone",
                "commercial",
                "ville",
                "dates",
                "montants",
              ]}
              value={advanced}
              onChange={setAdvanced}
            />
          </div>
        )}

        {advancedChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            {advancedChips.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
            <button
              type="button"
              onClick={() => setAdvanced({})}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Retirer les filtres avancés"
            >
              <X className="h-3 w-3" /> Retirer
            </button>
          </div>
        )}

        {isLoading ? (
          <ListSkeletonRows rows={10} />
        ) : (
        <ResponsiveTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Reste dû</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Retour</TableHead>
                <TableHead>FNE</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-6">
                    {hasActiveFilters ? (
                      <EmptyState
                        icon={FileText}
                        title="Aucune facture ne correspond aux filtres"
                        description="Ajuste tes critères ou réinitialise pour retrouver l'ensemble des factures de l'exercice."
                        onReset={resetAllFilters}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="font-medium">Aucune facture pour cet exercice</p>
                        <p className="max-w-md text-sm text-muted-foreground">
                          Les factures sont générées automatiquement à la validation d'une commande.
                        </p>
                        <Button asChild>
                          <Link to="/commandes/nouvelle">Nouvelle facture</Link>
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>

              ) : (
                factures.map((f) => {
                  const statutMeta = STATUT_FACTURE_LABEL[f.statut];
                  const reste = Number(f.montant_total) - Number(f.montant_paye);
                  const fneInfo = fneMap[f.facture_id];
                  const enRetard =
                    !!f.date_echeance &&
                    f.date_echeance < today &&
                    reste > 0 &&
                    f.statut !== "annulee" &&
                    f.statut !== "avoir";
                  return (
                    <TableRow key={f.facture_id}>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          to="/factures/$factureId"
                          params={{ factureId: f.facture_id }}
                          className="ds-ref font-semibold text-foreground hover:underline"
                        >
                          {formatDocumentReference(f.reference)}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(f.date_facture)}</TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap",
                          enRetard ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {f.date_echeance ? formatDate(f.date_echeance) : "—"}
                      </TableCell>
                      <TableCell className="min-w-[200px] font-medium"><ClientLink clientId={f.client_id} nom={f.client_nom} /></TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatFCFA(Number(f.montant_total))}
                        {(() => {
                          const t = (f as any).type_frais_transport as string | null;
                          const m = Number((f as any).montant_frais_transport ?? 0);
                          if (!t || m <= 0) return null;
                          return (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              dont {t === "expedition" ? "expédition" : "livraison"} {formatFCFA(m)}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatFCFA(Number(f.montant_paye))}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right tabular-nums",
                          reste === 0 ? "text-muted-foreground/60" : "font-semibold",
                        )}
                      >
                        {formatFCFA(reste)}
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={FACTURE_STATUT_TONE[f.statut] ?? "neutral"}>
                          {statutMeta?.label ?? f.statut}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const rs = retoursMap[f.facture_id] ?? [];
                          const resume = computeRetourResume(Number(f.montant_total), rs);
                          const meta = RETOUR_STATUS_META[resume.status];
                          return (
                            <span
                              className="whitespace-nowrap text-xs text-muted-foreground"
                              title={
                                resume.retours.length
                                  ? `${resume.retours.length} retour(s) — ${formatFCFA(resume.totalMontantRetour)}`
                                  : "Aucun retour"
                              }
                            >
                              {meta.label}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <FneStatusBadge info={fneInfo} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Actions ${f.reference}`}>
                          <div className="flex flex-col items-stretch gap-2">
                            <p className="ds-caption">Documents</p>
                            <FacturePdfActions facture={f} pdfState={pdf.getState(f.facture_id)} />
                            <p className="ds-caption mt-1">Facture normalisée (FNE)</p>
                            <div className="flex justify-end">
                              <FneRowActions
                                facture={{
                                  facture_id: f.facture_id,
                                  reference: f.reference,
                                  client_nom: f.client_nom,
                                  montant_total: Number(f.montant_total),
                                  date_facture: f.date_facture,
                                }}
                                fneStatut={(fneInfo?.statut as FNEStatus | undefined) ?? null}
                              />
                            </div>
                          </div>
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
        )}
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={totalCount}
          noun="factures"
          onPage={setPage}
          disabled={isLoading}
        />
      </ListCard>
    </div>
  );
}
