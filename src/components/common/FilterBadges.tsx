import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type FilterBadge = {
  key: string;
  label: ReactNode;
  onClear: () => void;
};

type Props = {
  badges: FilterBadge[];
  onResetAll: () => void;
  className?: string;
};

/**
 * Rangée de badges décrivant les filtres actifs, avec ✕ par badge
 * et un bouton "Réinitialiser" global. Rendu uniquement quand
 * `badges.length > 0`.
 */
export function FilterBadges({ badges, onResetAll, className }: Props) {
  if (badges.length === 0) return null;
  return (
    <div className={"flex flex-wrap items-center gap-2 " + (className ?? "")}>
      <span className="text-xs font-medium text-muted-foreground">Filtres actifs :</span>
      {badges.map((b) => (
        <Badge key={b.key} variant="secondary" className="gap-1 pr-1">
          <span>{b.label}</span>
          <button
            type="button"
            onClick={b.onClear}
            aria-label="Retirer le filtre"
            className="ml-1 rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResetAll}
        className="h-7 gap-1 text-xs"
      >
        Réinitialiser
      </Button>
    </div>
  );
}
