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
import { Textarea } from "@/components/ui/textarea";
import type { TourneeCout } from "./types";
import { friendlyError } from "@/lib/friendly-error";

export function RefuseDialog({
  row,
  onClose,
  onDone,
}: {
  row: TourneeCout | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (row) setComment("");
  }, [row]);
  if (!row) return null;
  const submit = async () => {
    if (!comment.trim()) {
      toast.error("Un motif est requis pour refuser.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("refuser_tournee_couts", {
      _tournee_id: row.tournee_id,
      _motif: comment,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Coûts refusés.");
    onDone();
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser les coûts — {row.reference}</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={4}
          placeholder="Motif du refus"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "…" : "Refuser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
