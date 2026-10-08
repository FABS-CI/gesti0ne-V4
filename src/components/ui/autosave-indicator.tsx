import { Check, CloudOff, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  status: "idle" | "saving" | "saved" | "error";
  savedAt: number | null;
  hasDraft?: boolean;
  onRestore?: () => void;
  onDiscard?: () => void;
  className?: string;
};

export function AutosaveIndicator({
  status,
  savedAt,
  hasDraft,
  onRestore,
  onDiscard,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Sauvegarde…</span>
        </>
      )}
      {status === "saved" && savedAt && (
        <>
          <Check className="h-3.5 w-3.5 text-success" />
          <span>Brouillon enregistré {formatRelative(savedAt)}</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="h-3.5 w-3.5 text-destructive" />
          <span>Sauvegarde impossible</span>
        </>
      )}
      {hasDraft && onRestore && (
        <div className="ml-2 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={onRestore}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Restaurer le brouillon
          </Button>
          {onDiscard && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={onDiscard}
            >
              Ignorer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 5) return "à l'instant";
  if (diff < 60) return `il y a ${diff}s`;
  const m = Math.round(diff / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return `il y a ${h}h`;
}
