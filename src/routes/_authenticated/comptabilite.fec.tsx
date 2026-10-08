import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import {
  SOCIETES,
  buildFecContent,
  downloadBlob,
  presetRange,
  validateEcritures,
} from "@/lib/fec-helpers";
import { buildFecZip } from "@/lib/fec-zip";
import { useFecEcritures } from "@/hooks/use-fec-ecritures";
import { FecSocietePeriodeCard } from "@/components/comptabilite/fec/FecSocietePeriodeCard";
import { FecValidationCards } from "@/components/comptabilite/fec/FecValidationCards";
import { FecPreviewCard } from "@/components/comptabilite/fec/FecPreviewCard";
import { FecColonnesCard } from "@/components/comptabilite/fec/FecColonnesCard";
import { FecProgressCard } from "@/components/comptabilite/fec/FecProgressCard";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/comptabilite/fec")({
  component: FecExportPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function FecExportPage() {
  const [societe, setSociete] = useState(SOCIETES[0].code);
  const [preset, setPreset] = useState<string>("mois");
  const initial = presetRange(preset);
  const [dateFrom, setDateFrom] = useState(initial.defaultFrom);
  const [dateTo, setDateTo] = useState(initial.defaultTo);
  const [zipStep, setZipStep] = useState<string>("");
  const [zipProgress, setZipProgress] = useState<number>(0);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const onPreset = (v: string) => {
    setPreset(v);
    if (v === "custom") return;
    const r = presetRange(v);
    setDateFrom(r.defaultFrom);
    setDateTo(r.defaultTo);
  };

  const societeNom = SOCIETES.find((s) => s.code === societe)?.nom ?? societe;
  const rangeValid = !!dateFrom && !!dateTo && dateFrom <= dateTo;

  const { data: ecritures = [], isLoading } = useFecEcritures(dateFrom, dateTo, rangeValid);

  const validation = useMemo(() => validateEcritures(ecritures), [ecritures]);
  const fecContent = useMemo(
    () => (ecritures.length ? buildFecContent(ecritures) : ""),
    [ecritures],
  );
  const previewLines = useMemo(() => {
    if (!fecContent) return [] as string[];
    return fecContent.split("\r\n").slice(0, 11);
  }, [fecContent]);

  const canDownload = rangeValid && ecritures.length > 0 && validation.blocking.length === 0;
  const fecName = `FEC_${societe}_${dateFrom}_${dateTo}.txt`;

  const downloadFec = () => {
    if (!canDownload) return;
    downloadBlob(new Blob([fecContent], { type: "text/plain;charset=utf-8" }), fecName);
    toast.success(`FEC généré (${ecritures.length} écritures)`);
  };

  const zip = useMutation({
    mutationFn: async () => {
      if (!canDownload) throw new Error("Corrigez les erreurs avant de générer le ZIP.");
      cancelRef.current = { cancelled: false };
      await buildFecZip({
        societe,
        dateFrom,
        dateTo,
        fecName,
        fecContent,
        ecritures,
        cancelRef,
        bump: (pct, label) => {
          setZipProgress(pct);
          setZipStep(label);
        },
      });
    },
    onSuccess: () => {
      toast.success("Archive comptable générée");
      setTimeout(() => {
        setZipProgress(0);
        setZipStep("");
      }, 1200);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Erreur lors de la génération";
      if (msg.includes("annulée")) toast.info(msg);
      else toast.error(msg);
      setZipProgress(0);
      setZipStep("");
    },
  });

  const cancelZip = () => {
    cancelRef.current.cancelled = true;
    setZipStep("Annulation en cours…");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="ds-page-title">Export FEC</h1>
          <p className="text-sm text-muted-foreground">
            Fichier des Écritures Comptables — format légal DGI (18 colonnes, séparateur « | »)
          </p>
        </div>
      </div>

      <FecSocietePeriodeCard
        societe={societe}
        setSociete={setSociete}
        preset={preset}
        onPreset={onPreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        setPreset={setPreset}
      />

      {!rangeValid && (
        <div className="rounded-md border border-warning/50 bg-warning/10 px-4 py-2 text-sm text-warning">
          La date « Du » doit précéder la date « Au ».
        </div>
      )}

      <FecValidationCards blocking={validation.blocking} warnings={validation.warnings} />

      {(zip.isPending || zipProgress > 0) && (
        <FecProgressCard progress={zipProgress} step={zipStep} />
      )}

      <FecPreviewCard
        societeNom={societeNom}
        ecrituresCount={ecritures.length}
        previewLines={previewLines}
        isLoading={isLoading}
        canDownload={canDownload}
        zipPending={zip.isPending}
        onDownloadFec={downloadFec}
        onGenerateZip={() => zip.mutate()}
        onCancelZip={cancelZip}
      />

      <FecColonnesCard />
    </div>
  );
}
