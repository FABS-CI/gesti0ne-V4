import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PreviewState = { url: string; title: string; fileName: string } | null;

type Props = {
  preview: PreviewState;
  onClose: () => void;
};

export function DeclarationPreviewDialog({ preview, onClose }: Props) {
  return (
    <Dialog
      open={!!preview}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">Aperçu — {preview?.title}</DialogTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!preview) return;
                const a = document.createElement("a");
                a.href = preview.url;
                a.download = preview.fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              Télécharger
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        {preview && (
          <iframe src={preview.url} className="flex-1 w-full" title={`Aperçu ${preview.title}`} />
        )}
      </DialogContent>
    </Dialog>
  );
}
