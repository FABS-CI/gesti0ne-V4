import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer } from "lucide-react";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";
import { printBlob } from "@/lib/pdf/actions";
import { PdfCanvasViewer } from "./PdfCanvasViewer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  filename: string;
  /** Fabrique de Blob — appelée à l'ouverture, mise en cache via pdfCache si besoin. */
  load: () => Promise<Blob>;
};

/**
 * Aperçu PDF dans un iframe sans déclencher l'impression du navigateur.
 * Sert à vérifier marges / pagination / chevauchements avant impression.
 */
export function PdfPreviewModal({ open, onOpenChange, title, filename, load }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    let current: string | null = null;
    setLoading(true);
    load()
      .then((b) => {
        if (revoked) return;
        // Android WebView (APK) ne rend pas les PDF dans un <iframe>.
        // On enregistre directement le fichier via le pont natif et on
        // ferme la modale — l'utilisateur récupère le PDF dans Téléchargements.
        const androidBridge = (
          globalThis as unknown as {
            AndroidFileSaver?: { saveBase64: (n: string, b: string, m: string) => void };
          }
        ).AndroidFileSaver;
        if (androidBridge) {
          downloadBlob(b, filename);
          onOpenChange(false);
          return;
        }
        current = URL.createObjectURL(b);
        setBlob(b);
        setUrl(current);
      })
      .finally(() => setLoading(false));
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
      setBlob(null);
    };
    // load est stable par convention d'appel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{title}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!blob}
                onClick={() => blob && downloadBlob(blob, filename)}
              >
                <Download className="mr-2 h-4 w-4" /> Télécharger
              </Button>
              <Button size="sm" disabled={!blob} onClick={() => blob && printBlob(blob)}>
                <Printer className="mr-2 h-4 w-4" /> Imprimer
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 rounded border bg-muted/30">
          {loading || !url || !blob ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Génération du PDF…
            </div>
          ) : (
            <PdfCanvasViewer blob={blob} title={title} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
