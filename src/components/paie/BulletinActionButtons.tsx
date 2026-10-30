import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/friendly-error";
import {
  annulerBulletin,
  estAnnulable,
  estValidable,
  telechargerBulletin,
  validerBulletin,
} from "@/lib/paie-bulletin-actions";

export function BulletinActionButtons({
  bulletinId,
  statut,
  size = "sm",
  showLabels = false,
}: {
  bulletinId: string;
  statut: unknown;
  size?: "sm" | "icon";
  showLabels?: boolean;
}) {
  const qc = useQueryClient();
  const [validating, setValidating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState("");
  const [annulant, setAnnulant] = useState(false);

  const rafraichir = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["bulletins_paie"] }),
      qc.invalidateQueries({ queryKey: ["bulletin", bulletinId] }),
    ]);

  async function onValider(e: React.MouseEvent) {
    e.stopPropagation();
    setValidating(true);
    try {
      await validerBulletin(bulletinId);
      toast.success("Bulletin validé");
      await rafraichir();
    } catch (err) {
      toast.error(friendlyError(err, "Validation impossible"));
    } finally {
      setValidating(false);
    }
  }

  // Annulation tracée : l'écriture comptable du bulletin est contre-passée.
  async function onAnnuler() {
    setAnnulant(true);
    try {
      await annulerBulletin(bulletinId, motif.trim());
      toast.success("Bulletin annulé : son écriture comptable est contre-passée.");
      setAnnulation(false);
      setMotif("");
      await rafraichir();
    } catch (err) {
      toast.error(friendlyError(err, "Annulation impossible"));
    } finally {
      setAnnulant(false);
    }
  }

  async function onTelecharger(e: React.MouseEvent) {
    e.stopPropagation();
    setDownloading(true);
    try {
      await telechargerBulletin(bulletinId);
    } catch (err) {
      toast.error(friendlyError(err, "Téléchargement impossible"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <span className="inline-flex gap-1">
      {estValidable(statut) && (
        <Button size={size} variant="outline" onClick={onValider} disabled={validating} title="Valider" aria-label="Valider">
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {showLabels && <span className="ml-2">Valider</span>}
        </Button>
      )}
      {estAnnulable(statut) && (
        <Button
          size={size}
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setAnnulation(true);
          }}
          title="Annuler le bulletin"
          aria-label="Annuler le bulletin"
        >
          <Ban className="h-4 w-4" />
          {showLabels && <span className="ml-2">Annuler</span>}
        </Button>
      )}
      <Button size={size} variant="outline" onClick={onTelecharger} disabled={downloading} title="Télécharger" aria-label="Télécharger">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {showLabels && <span className="ml-2">{downloading ? "Génération…" : "Télécharger"}</span>}
      </Button>

      <Dialog open={annulation} onOpenChange={(o) => !o && setAnnulation(false)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Annuler le bulletin</DialogTitle>
            <DialogDescription>
              Le bulletin reste consultable avec le statut « Annulé » et son écriture comptable
              est contre-passée. La période peut ensuite être recalculée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`motif-annulation-${bulletinId}`}>Motif (obligatoire)</Label>
            <Textarea
              id={`motif-annulation-${bulletinId}`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnulation(false)}>
              Fermer
            </Button>
            <Button
              variant="destructive"
              disabled={annulant || motif.trim().length < 5}
              onClick={onAnnuler}
            >
              {annulant && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Annuler le bulletin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
