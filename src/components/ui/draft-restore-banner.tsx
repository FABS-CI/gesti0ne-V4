import { FileClock } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Date ISO de dernière modification du brouillon. */
  updatedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
  /** Libellé du document, ex. « bon de réception ». */
  label?: string;
};

/**
 * Bandeau proposant de reprendre un brouillon non terminé
 * (voir `useServerDraft`).
 */
export function DraftRestoreBanner({ updatedAt, onRestore, onDiscard, label }: Props) {
  const when = (() => {
    const d = new Date(updatedAt);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
      : "";
  })();

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning/60 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">
            Un brouillon non terminé a été trouvé
            {label ? ` pour cette ${label}` : ""} — souhaitez-vous la reprendre ou recommencer ?
          </p>
          {when ? (
            <p className="text-muted-foreground">Dernière sauvegarde automatique : {when}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Recommencer
        </Button>
        <Button size="sm" onClick={onRestore}>
          Reprendre
        </Button>
      </div>
    </div>
  );
}
