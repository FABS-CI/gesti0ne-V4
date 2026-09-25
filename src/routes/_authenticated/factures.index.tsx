import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileDown, FileText, Search, RotateCcw, X, Package } from "lucide-react";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 shrink-0 text-primary" /> Factures
          </h1>
          <p className="text-sm text-muted-foreground">
            Consultation — les factures sont générées automatiquement à la validation d'une commande
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!factures.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={!factures.length}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <FacturesKpis {...totals} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_FACTURE.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card p-3">
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

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {q && (
            <Badge variant="secondary" className="gap-1">
              Recherche : {q}
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ml-1 rounded-full hover:bg-muted"
                aria-label="Retirer le filtre de recherche"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statutFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Statut : {STATUT_FACTURE_LABEL[statutFilter]?.label ?? statutFilter}
              <button
                type="button"
                onClick={() => setStatutFilter("all")}
                className="ml-1 rounded-full hover:bg-muted"
                aria-label="Retirer le filtre de statut"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {advancedChips.map((c) => (
            <Badge key={c} variant="secondary">
              {c}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={resetAllFilters}>
            <RotateCcw className="mr-1 h-3 w-3" /> Réinitialiser
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Retour</TableHead>
                <TableHead>FNE</TableHead>
                <TableHead className="text-right">FNE actions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-4">
                    <SkeletonTable rows={8} cols={7} />
                  </TableCell>
                </TableRow>
              ) : factures.length === 0 ? (
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
                      <EmptyState
                        variant="rich"
                        icon={FileText}
                        title="Aucune facture pour cet exercice"
                        description="Les factures sont générées automatiquement quand tu valides une commande. Crée d'abord une commande pour voir apparaître ta première facture ici."
                        hints={
                          <span className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                            Cycle · Commande → Bon de livraison → Facture → Paiement
                          </span>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>

              ) : (
                factures.map((f) => {
                  const statutMeta = STATUT_FACTURE_LABEL[f.statut];
                  const reste = Number(f.montant_total) - Number(f.montant_paye);
                  const fneInfo = fneMap[f.facture_id];
                  return (
                    <TableRow key={f.facture_id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <ProductCoverThumb produit={null} size="xs" />
                          {f.reference}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(f.date_facture)}</TableCell>
                      <TableCell className="font-medium">{f.client_nom}</TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(Number(f.montant_total))}
                        {(() => {
                          const t = (f as any).type_frais_transport as string | null;
                          const m = Number((f as any).montant_frais_transport ?? 0);
                          if (!t || m <= 0) return null;
                          return (
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                              dont {t === "expedition" ? "expédition" : "livraison"} {formatFCFA(m)}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatFCFA(Number(f.montant_paye))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatFCFA(reste)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{ color: statutMeta?.color, borderColor: statutMeta?.color }}
                        >
                          {statutMeta?.label ?? f.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const rs = retoursMap[f.facture_id] ?? [];
                          const resume = computeRetourResume(Number(f.montant_total), rs);
                          const meta = RETOUR_STATUS_META[resume.status];
                          return (
                            <Badge
                              variant="outline"
                              style={{ color: meta.color, borderColor: meta.color }}
                              title={
                                resume.retours.length
                                  ? `${resume.retours.length} retour(s) — ${formatFCFA(resume.totalMontantRetour)}`
                                  : "Aucun retour"
                              }
                            >
                              {meta.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <FneStatusBadge info={fneInfo} />
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                      <TableCell className="text-right">
                        <FacturePdfActions facture={f} pdfState={pdf.getState(f.facture_id)} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} sur {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <span className="px-2 py-1">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
