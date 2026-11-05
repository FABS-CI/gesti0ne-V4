import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** URL de la route imprimable (ex: /bon-de-tournee/:id) — `?embed=1` sera ajouté. */
  routeUrl: string;
};

/**
 * Aperçu intégré : charge une route imprimable dans un iframe (même origine,
 * session partagée). Évite d'ouvrir un nouvel onglet.
 */
export function RoutePreviewModal({ open, onOpenChange, title, routeUrl }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const src = routeUrl.includes("?") ? `${routeUrl}&embed=1` : `${routeUrl}?embed=1`;

  const print = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try {
      w.focus();
      w.print();
    } catch {
      // no-op
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col gap-3 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{title}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(routeUrl, "_blank")}>
                Nouvel onglet
              </Button>
              <Button size="sm" onClick={print}>
                Imprimer
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-muted/30">
          <iframe ref={iframeRef} title={title} src={src} className="h-full w-full border-0" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
