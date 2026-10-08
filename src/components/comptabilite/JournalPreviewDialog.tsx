import { formatDateTime } from "@/lib/format";
import { useState } from "react";
import { Download, Eye, Maximize2, Minimize2, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  url: string | null;
  onClose: () => void;
  onPrint: () => void;
  onDownload: () => void;
  periodeLabel: string;
  generatedAt: Date | null;
  pdfLoading: boolean;
}

export function JournalPreviewDialog({
  url,
  onClose,
  onPrint,
  onDownload,
  periodeLabel,
  generatedAt,
  pdfLoading,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);

  function handleClose() {
    setZoom(100);
    setFullscreen(false);
    onClose();
  }

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className={fullscreen ? "h-[100vh] w-screen max-w-none rounded-none p-4" : "max-w-5xl"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Aperçu du journal comptable
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Période : {periodeLabel}</span>
            {generatedAt && <span>Généré le {formatDateTime(generatedAt)}</span>}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-y py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              disabled={zoom <= 50}
              aria-label="Dézoomer"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-sm tabular-nums">{zoom}%</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              disabled={zoom >= 200}
              aria-label="Zoomer"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? (
              <>
                <Minimize2 className="mr-2 h-4 w-4" /> Réduire
              </>
            ) : (
              <>
                <Maximize2 className="mr-2 h-4 w-4" /> Plein écran
              </>
            )}
          </Button>
        </div>

        {url && (
          <iframe
            key={`${zoom}-${fullscreen}`}
            title="Aperçu du journal comptable"
            src={`${url}#zoom=${zoom}&toolbar=1&navpanes=0`}
            className={
              fullscreen
                ? "h-[calc(100vh-220px)] w-full rounded-md border"
                : "h-[70vh] w-full rounded-md border"
            }
          />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Fermer
          </Button>
          <Button variant="outline" onClick={onPrint} disabled={pdfLoading}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
          <Button onClick={onDownload} disabled={pdfLoading}>
            <Download className="mr-2 h-4 w-4" /> Télécharger le PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
