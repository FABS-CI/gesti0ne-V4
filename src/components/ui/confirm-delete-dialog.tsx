import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Boîte de dialogue de confirmation de suppression standardisée pour l'ERP.
 *
 * - `consequences` : liste à puces des modules automatiquement mis à jour.
 * - `motifRequired` : force la saisie d'un motif (utilisé pour les opérations critiques).
 * - `requireTyping` : force l'utilisateur à recopier un mot-clé (ex. "SUPPRIMER")
 *   avant d'activer le bouton de confirmation.
 */
export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  entityLabel?: string;
  entityName?: string | null;
  description?: string;
  consequences?: string[];
  motifRequired?: boolean;
  motifPlaceholder?: string;
  requireTyping?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: (motif: string | null) => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Confirmer la suppression",
  entityLabel = "cette donnée",
  entityName,
  description = "Cette action est irréversible et mettra automatiquement à jour les modules liés.",
  consequences,
  motifRequired = false,
  motifPlaceholder = "Motif de la suppression",
  requireTyping,
  confirmLabel = "Confirmer la suppression",
  cancelLabel = "Annuler",
  pending = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [motif, setMotif] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setMotif("");
      setTyped("");
    }
  }, [open]);

  const motifOk = !motifRequired || motif.trim().length > 0;
  const typingOk = !requireTyping || typed.trim() === requireTyping;
  const canConfirm = motifOk && typingOk && !pending;

  return (
    <Dialog open={open} onOpenChange={(o) => (!pending ? onOpenChange(o) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de supprimer <span className="font-semibold">{entityLabel}</span>
            {entityName ? (
              <>
                {" "}
                <span className="font-mono text-xs">{entityName}</span>
              </>
            ) : null}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-destructive font-medium">{description}</p>

          {consequences && consequences.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Conséquences automatiques :
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs">
                {consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {motifRequired && (
            <div className="space-y-1">
              <Label htmlFor="confirm-delete-motif">
                Motif <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="confirm-delete-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={motifPlaceholder}
                rows={2}
              />
            </div>
          )}

          {requireTyping && (
            <div className="space-y-1">
              <Label htmlFor="confirm-delete-typing">
                Pour confirmer, tapez{" "}
                <span className="font-mono font-semibold">{requireTyping}</span>
              </Label>
              <Input
                id="confirm-delete-typing"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => onConfirm(motifRequired ? motif.trim() : null)}
          >
            {pending ? "Suppression…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
