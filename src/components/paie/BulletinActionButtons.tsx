import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/friendly-error";
import { estValidable, telechargerBulletin, validerBulletin } from "@/lib/paie-bulletin-actions";

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

  async function onValider(e: React.MouseEvent) {
    e.stopPropagation();
    setValidating(true);
    try {
      await validerBulletin(bulletinId);
      toast.success("Bulletin validé");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["bulletins_paie"] }),
        qc.invalidateQueries({ queryKey: ["bulletin", bulletinId] }),
      ]);
    } catch (err) {
      toast.error(friendlyError(err, "Validation impossible"));
    } finally {
      setValidating(false);
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
      <Button size={size} variant="outline" onClick={onTelecharger} disabled={downloading} title="Télécharger" aria-label="Télécharger">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {showLabels && <span className="ml-2">{downloading ? "Génération…" : "Télécharger"}</span>}
      </Button>
    </span>
  );
}
