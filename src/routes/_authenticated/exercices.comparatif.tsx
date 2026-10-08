import { getCurrentUser } from "@/lib/current-user";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, FileDown, GitCompare, Inbox } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { zodValidator } from "@tanstack/zod-adapter";
import { comparatifSearchSchema, type ComparatifSearch } from "@/lib/route-schemas";

import { supabase } from "@/integrations/supabase/client";
import { useExercice } from "@/contexts/ExerciceContext";
import { exportPdf } from "@/lib/export-csv";
import { buildPdfMeta } from "@/lib/pdf-comparatif";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useExercicesComparatif, type ComparatifRow } from "@/hooks/use-exercices-comparatif";
import {
  ComparatifFilters,
  type SortKey,
} from "@/components/exercices/comparatif/ComparatifFilters";
import { ComparatifTable } from "@/components/exercices/comparatif/ComparatifTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const LS_KEY = "exercices-comparatif-state-v1";

export const Route = createFileRoute("/_authenticated/exercices/comparatif")({
  validateSearch: zodValidator(comparatifSearchSchema),
  component: ComparatifPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ComparatifPage() {
  const { exercices } = useExercice();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sortKey = search.sort as SortKey;
  const sortDir = search.dir as "asc" | "desc";
  const showPct = search.pct as boolean;

  // Restauration depuis localStorage si aucun paramètre d'URL n'est présent.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const url = new URL(window.location.href);
    const hasAnyParam = ["exos", "sort", "dir", "pct"].some((k) => url.searchParams.has(k));
    if (hasAnyParam) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = comparatifSearchSchema.partial().safeParse(JSON.parse(raw));
      if (!parsed.success) return;
      navigate({ search: () => parsed.data as ComparatifSearch, replace: true });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauvegarde
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ exos: search.exos, sort: sortKey, dir: sortDir, pct: showPct }),
      );
    } catch {
      /* ignore */
    }
  }, [search.exos, sortKey, sortDir, showPct]);

  // Sélection : `exos` non défini = tous les exercices ; chaîne vide = aucun.
  const selected = useMemo<Set<string>>(() => {
    if (search.exos === undefined) return new Set(exercices.map((e) => e.exercice_id));
    if (search.exos === "") return new Set();
    return new Set(search.exos.split(","));
  }, [search.exos, exercices]);

  function setSelected(next: Set<string>) {
    const all = exercices.map((e) => e.exercice_id);
    const isAll = next.size === all.length && all.every((id) => next.has(id));
    navigate({
      search: (prev: ComparatifSearch) => ({
        ...prev,
        exos: isAll ? undefined : [...next].join(","),
      }),
      replace: true,
    });
  }

  const { data: rows = [], isLoading, error, refetch } = useExercicesComparatif(exercices);

  const filteredRows = useMemo(() => {
    const base = rows.filter((r) => selected.has(r.exercice_id));
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey as keyof ComparatifRow];
      const bv = b[sortKey as keyof ComparatifRow];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, selected, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    navigate({
      search: (prev: ComparatifSearch) => ({
        ...prev,
        sort: key,
        dir: prev.sort === key ? (prev.dir === "asc" ? "desc" : "asc") : "desc",
      }),
      replace: true,
    });
  }

  function setSortKey(key: SortKey) {
    navigate({ search: (prev: ComparatifSearch) => ({ ...prev, sort: key }), replace: true });
  }
  function setSortDir(dir: "asc" | "desc") {
    navigate({ search: (prev: ComparatifSearch) => ({ ...prev, dir }), replace: true });
  }
  function setShowPct(v: boolean) {
    navigate({ search: (prev: ComparatifSearch) => ({ ...prev, pct: v }), replace: true });
  }

  async function handleExportPdf() {
    const { data: authData } = await getCurrentUser();
    const userEmail = authData?.user?.email ?? "—";
    const now = new Date();
    const timestamp = `${now.toLocaleDateString("fr-FR")} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    const meta = buildPdfMeta({
      userEmail,
      timestamp,
      rows: filteredRows,
      sortKey: sortKey as SortKey,
      sortDir,
      showPct,
    });
    await exportPdf(meta.fileBase, meta.headers, meta.rows, {
      pageTitle: meta.pageTitle,
      summary: meta.summary,
    });
  }

  const hasSelection = selected.size > 0;
  const noExercices = !isLoading && exercices.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/exercices">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="ds-page-title flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-primary" /> Comparatif multi-exercices
          </h1>
          <p className="text-sm text-muted-foreground">
            Évolution du chiffre d'affaires, des encaissements et du résultat par exercice
          </p>
        </div>
        <Button variant="outline" onClick={handleExportPdf} disabled={!filteredRows.length}>
          <FileDown className="mr-2 h-4 w-4" /> Exporter PDF
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Impossible de charger le comparatif</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error instanceof Error ? error.message : "Erreur inattendue"}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {noExercices && (
        <Alert>
          <Inbox className="h-4 w-4" />
          <AlertTitle>Aucun exercice</AlertTitle>
          <AlertDescription>
            Créez d'abord un exercice depuis la page Exercices pour générer un comparatif.
          </AlertDescription>
        </Alert>
      )}

      <ComparatifFilters
        exercices={exercices}
        selected={selected}
        onSelectedChange={setSelected}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDir={sortDir}
        onSortDir={setSortDir}
        showPct={showPct}
        onShowPct={setShowPct}
      />

      <ComparatifTable
        isLoading={isLoading}
        rows={filteredRows}
        hasSelection={hasSelection}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        showPct={showPct}
        onSelectAll={() => setSelected(new Set(exercices.map((e) => e.exercice_id)))}
      />
    </div>
  );
}
