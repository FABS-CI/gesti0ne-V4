import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PdfPreviewModal } from "@/components/pdf/PdfPreviewModal";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";
import {
  generateSamplePdf,
  SAMPLE_DOC_TYPES,
  type SampleDocType,
  type SamplePayment,
} from "@/lib/pdf/sample-documents";
import type { RecapThemeId } from "@/lib/pdf/recap-themes";

type Props = {
  docType: SampleDocType;
  onDocTypeChange: (t: SampleDocType) => void;
  theme: RecapThemeId;
};

/** Aperçu complet généré par le vrai moteur PDF (jamais mis en cache). */
export function RecapThemePreview({ docType, onDocTypeChange, theme }: Props) {
  const [payment, setPayment] = useState<SamplePayment>("aucun");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [big, setBig] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      generateSamplePdf(docType, theme, payment)
        .then((b) => {
          if (id !== runId.current) return; // génération dépassée
          setBlob(b);
          setUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(b);
          });
        })
        .catch(() => id === runId.current && setError(true))
        .finally(() => id === runId.current && setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [docType, theme, payment]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const filename = `exemple-${docType}-${theme}.pdf`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type de document</Label>
          <Select value={docType} onValueChange={(v) => onDocTypeChange(v as SampleDocType)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_DOC_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {docType === "facture" && (
          <div className="space-y-1">
            <Label className="text-xs">Simuler un paiement</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as SamplePayment)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aucun">Aucun</SelectItem>
                <SelectItem value="partiel">Partiel</SelectItem>
                <SelectItem value="solde">Soldé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!blob} onClick={() => setBig(true)}>
            <Maximize2 className="mr-2 h-4 w-4" /> Ouvrir en grand
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!blob}
            onClick={() => blob && downloadBlob(blob, filename)}
          >
            <Download className="mr-2 h-4 w-4" /> Télécharger l'exemple
          </Button>
        </div>
      </div>
      <div className="relative h-[70vh] min-h-[480px] rounded-md border bg-muted/30">
        {url && (
          <iframe title="Aperçu du document" src={url} className="h-full w-full rounded-md" />
        )}
        {(loading || !url) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération de l'aperçu…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            L'aperçu n'a pas pu être généré.
          </div>
        )}
      </div>
      <PdfPreviewModal
        open={big}
        onOpenChange={setBig}
        title="Aperçu du document (exemple)"
        filename={filename}
        load={async () => blob ?? new Blob()}
      />
    </div>
  );
}
