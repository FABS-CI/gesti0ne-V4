import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA } from "@/lib/format";
import { type TourneeCout } from "./types";
import { friendlyError } from "@/lib/friendly-error";

export function ValidateDialog({
  row,
  onClose,
  onDone,
}: {
  row: TourneeCout | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"caisse" | "banque">("caisse");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (row) {
      setMode("caisse");
      setComment("");
    }
  }, [row]);
  if (!row) return null;
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("valider_decaissement_tournee", {
      _tournee_id: row.tournee_id,
      _mode_reglement: mode,
      _commentaire: comment || undefined,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Décaissement validé — écriture comptable générée.");
    onDone();
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valider le décaissement — {row.reference}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded bg-muted/40 p-3 text-sm">
            Montant à décaisser : <b>{formatFCFA(row.cout_total ?? 0)}</b>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mode de règlement</label>
            <Select value={mode} onValueChange={(v) => setMode(v as "caisse" | "banque")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caisse">Caisse (571)</SelectItem>
                <SelectItem value="banque">Banque (521)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Commentaire (facultatif)</label>
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Validation…" : "Valider le décaissement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
