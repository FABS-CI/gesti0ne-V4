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
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/use-permissions";
import type { Commande } from "@/lib/commandes-api";

export function DeleteCommandeDialog({
  commande,
  onOpenChange,
  onConfirm,
  pending,
}: {
  commande: Commande | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motif: string | null, force: boolean) => void;
  pending: boolean;
}) {
  const { isSuperAdmin } = usePermissions();
  const [motif, setMotif] = useState("");
  const [typed, setTyped] = useState("");
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (!commande) {
      setMotif("");
      setTyped("");
      setForce(false);
    }
  }, [commande]);

  const label = commande?.client_nom
    ? `${commande.reference} — ${commande.client_nom}`
    : (commande?.reference ?? "");

  const canConfirm =
    motif.trim().length > 0 && typed.trim() === (force ? "FORCER" : "SUPPRIMER") && !pending;

  return (
    <Dialog open={!!commande} onOpenChange={(o) => (!pending ? onOpenChange(o) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Supprimer définitivement cette commande ?
          </DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de supprimer{" "}
            <span className="font-semibold">le bon de commande</span>{" "}
            <span className="font-mono text-xs">{label}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-destructive font-medium">
            {force
              ? "Mode FORCER (Super Admin) — bypass des contrôles métier. Toutes les factures, paiements, BL et livraisons rattachés seront supprimés en cascade. Irréversible."
              : "Refusé si paiement validé, facture non annulée, ou BL expédié/livré. Préférer l'annulation dans ce cas."}
          </p>

          {isSuperAdmin && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
              <Checkbox
                id="force-delete"
                checked={force}
                onCheckedChange={(v) => {
                  setForce(v === true);
                  setTyped("");
                }}
              />
              <div className="text-xs">
                <div className="font-semibold text-destructive">
                  Forcer la suppression (Super Admin)
                </div>
                <div className="text-muted-foreground">
                  Bypass des contrôles métier — supprime factures, paiements et BL rattachés.
                </div>
              </div>
            </label>
          )}

          <div className="space-y-1">
            <Label htmlFor="confirm-delete-motif">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="confirm-delete-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif de la suppression (obligatoire pour audit)"
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-delete-typing">
              Pour confirmer, tapez{" "}
              <span className="font-mono font-semibold">{force ? "FORCER" : "SUPPRIMER"}</span>
            </Label>
            <Input
              id="confirm-delete-typing"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => onConfirm(motif.trim(), force)}
          >
            {pending
              ? "Suppression…"
              : force
                ? "Forcer la suppression"
                : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
