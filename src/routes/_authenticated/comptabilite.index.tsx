import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, Eye, FileText, Loader2, Plus } from "lucide-react";

import { exportCsv } from "@/lib/export-csv";
import { generateJournalComptablePDF, buildJournalFileName } from "@/lib/pdf/pdfGenerator";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { useComptabiliteEcritures } from "@/hooks/use-comptabilite-ecritures";
import {
  buildPeriodeLabel,
  validateJournalFilters,
  type JournalFiltersState,
} from "@/lib/comptabilite-helpers";

import { Button } from "@/components/ui/button";
import { JournalFilters } from "@/components/comptabilite/JournalFilters";
import { JournalKpis } from "@/components/comptabilite/JournalKpis";
import { JournalTable } from "@/components/comptabilite/JournalTable";
import { JournalPreviewDialog } from "@/components/comptabilite/JournalPreviewDialog";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/comptabilite/")({
  head: () => authRouteHead("Comptabilité"),
  component: ComptabilitePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const PDF_CACHE_MAX = 5;
const PDF_CACHE_TTL = 5 * 60 * 1000;

function ComptabilitePage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [journal, setJournal] = useState("all");
  const [lettrage, setLettrage] = useState("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const pdfCache = useRef<Map<string, { url: string; ts: number }>>(new Map());
  const q = useDebouncedValue(search, 300);
  const exerciceId = useExerciceConsulteId();

  const filters: JournalFiltersState = { dateFrom, dateTo, journal, lettrage };

  const { data: ecritures = [], isLoading } = useComptabiliteEcritures(exerciceId, q, filters);

  const { totalDebit, totalCredit } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const e of ecritures) {
      for (const l of e.ecriture_lignes) {
        d += Number(l.debit);
        c += Number(l.credit);
      }
    }
    return { totalDebit: d, totalCredit: c };
  }, [ecritures]);

  const periodeLabel = useMemo(
    () => buildPeriodeLabel(filters),
    [dateFrom, dateTo, journal, lettrage],
  );

  function handleExport() {
    const rows: string[][] = [];
    ecritures.forEach((e) => {
      e.ecriture_lignes.forEach((l) => {
        rows.push([
          e.reference,
          e.date_ecriture,
          e.journal,
          e.libelle,
          e.lettrage ?? "",
          l.compte,
          l.compte_libelle,
          String(l.debit),
          String(l.credit),
        ]);
      });
    });
    exportCsv(
      "journal_comptable",
      ["Pièce", "Date", "Journal", "Libellé", "Lettrage", "Compte", "Intitulé", "Débit", "Crédit"],
      rows,
    );
  }

  function checkFilters(): string | null {
    const err = validateJournalFilters(ecritures, { dateFrom, dateTo });
    setFilterError(err);
    return err;
  }

  async function handleExportPdf() {
    if (checkFilters()) return;
    try {
      await generateJournalComptablePDF(ecritures, { dateFrom, dateTo, journal, lettrage });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Erreur lors de la génération du PDF.");
      return;
    }
    setGeneratedAt(new Date());
  }

  function pruneCache() {
    const now = Date.now();
    const cache = pdfCache.current;
    for (const [k, v] of cache) {
      if (now - v.ts > PDF_CACHE_TTL) {
        URL.revokeObjectURL(v.url);
        cache.delete(k);
      }
    }
    while (cache.size > PDF_CACHE_MAX) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      const v = cache.get(oldest);
      if (v) URL.revokeObjectURL(v.url);
      cache.delete(oldest);
    }
  }

  async function getCachedPreviewUrl(): Promise<string | null> {
    if (checkFilters()) return null;
    const key = JSON.stringify({ dateFrom, dateTo, journal, lettrage, q });
    const cache = pdfCache.current;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts <= PDF_CACHE_TTL) {
      cache.delete(key);
      cache.set(key, { url: hit.url, ts: Date.now() });
      return hit.url;
    }
    if (hit) {
      URL.revokeObjectURL(hit.url);
      cache.delete(key);
    }
    setPdfError(null);
    setPdfLoading(true);
    try {
      const url = await generateJournalComptablePDF(
        ecritures,
        { dateFrom, dateTo, journal, lettrage },
        "preview",
      );
      if (!url) {
        setPdfError("Impossible de générer le PDF.");
        return null;
      }
      cache.set(key, { url, ts: Date.now() });
      pruneCache();
      setGeneratedAt(new Date());
      return url;
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Erreur lors de la génération du PDF.");
      return null;
    } finally {
      setPdfLoading(false);
    }
  }

  async function handlePreviewPdf() {
    const url = await getCachedPreviewUrl();
    if (url) setPreviewUrl(url);
  }

  function triggerIframePrint(): boolean {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Aperçu du journal comptable"]',
    );
    try {
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return true;
      }
    } catch {
      // fallback
    }
    return false;
  }

  async function handlePrintPdf() {
    const url = previewUrl ?? (await getCachedPreviewUrl());
    if (!url) return;
    if (!previewUrl) setPreviewUrl(url);
    setTimeout(() => {
      if (!triggerIframePrint()) {
        const win = window.open(url, "_blank");
        if (win) {
          win.addEventListener("load", () => win.print());
        } else {
          setPdfError(
            "Impression bloquée par le navigateur. Autorisez les pop-ups ou téléchargez le PDF.",
          );
        }
      }
    }, 400);
  }

  async function handleDownloadPdf() {
    const url = previewUrl ?? (await getCachedPreviewUrl());
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = buildJournalFileName({ dateFrom, dateTo, journal, lettrage });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  useEffect(() => {
    const cache = pdfCache.current;
    return () => {
      for (const { url } of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Journal comptable
          </h1>
          <p className="text-sm text-muted-foreground">
            Écritures générées automatiquement (ventes & encaissements)
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/comptabilite/nouvelle">
              <Plus className="mr-2 h-4 w-4" /> Nouvelle écriture
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!ecritures.length}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            onClick={handlePreviewPdf}
            disabled={!ecritures.length || pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Aperçu
          </Button>
          <Button onClick={handleExportPdf} disabled={!ecritures.length}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {filterError && (
        <div className="rounded-md border border-amber-400/50 bg-amber-100/40 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          {filterError}
        </div>
      )}

      {pdfError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {pdfError}
        </div>
      )}

      <JournalKpis totalDebit={totalDebit} totalCredit={totalCredit} />

      <JournalFilters
        search={search}
        onSearchChange={setSearch}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        journal={journal}
        onJournalChange={setJournal}
        lettrage={lettrage}
        onLettrageChange={setLettrage}
      />

      <JournalTable
        isLoading={isLoading}
        ecritures={ecritures}
        expanded={expanded}
        onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
      />

      <JournalPreviewDialog
        url={previewUrl}
        onClose={() => setPreviewUrl(null)}
        onPrint={handlePrintPdf}
        onDownload={handleDownloadPdf}
        periodeLabel={periodeLabel}
        generatedAt={generatedAt}
        pdfLoading={pdfLoading}
      />
    </div>
  );
}
