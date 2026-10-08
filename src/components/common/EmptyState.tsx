import type { ComponentType, ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  /** Rendu si l'utilisateur a des filtres actifs → propose de les réinitialiser. */
  onReset?: () => void;
  /** CTA principal (ex: "Nouvel élément"). Ignoré si `onReset` est fourni. */
  action?: ReactNode;
  /** Suggestions/raccourcis affichés sous le CTA (pastilles cliquables). */
  hints?: ReactNode;
  /** "compact" pour tableaux existants, "rich" pour empty state de page. */
  variant?: "compact" | "rich";
  className?: string;
};

/**
 * État vide contextuel pour listes/tables :
 *
 * - filtres actifs → texte "aucun résultat" + bouton Réinitialiser
 * - liste vraiment vide → texte "aucune donnée" + CTA de création
 *
 * Variante `rich` : icône dans un cercle mis en valeur, plus de respiration,
 * pensé pour les pages entièrement vides (Factures, Commandes, etc.).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  onReset,
  action,
  hints,
  variant = "compact",
  className,
}: Props) {
  const rich = variant === "rich";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center",
        rich ? "gap-5 py-16 px-6" : "gap-3 py-10 px-4",
        className,
      )}
    >
      {Icon ? (
        rich ? (
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -m-3 rounded-full bg-primary/10 blur-2xl"
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-md border border-border/60 bg-card">
              <Icon className="h-7 w-7 text-primary" aria-hidden />
            </div>
          </div>
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/60" aria-hidden />
        )
      ) : null}

      <div className={rich ? "space-y-2 max-w-md" : "space-y-1"}>
        <p className={rich ? "text-lg font-semibold tracking-tight" : "text-sm font-medium"}>
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              "text-muted-foreground",
              rich ? "text-sm leading-relaxed" : "text-xs",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {onReset ? (
        <Button type="button" variant="outline" size="sm" onClick={onReset} className="gap-1">
          <RotateCcw className="h-3 w-3" />
          Réinitialiser les filtres
        </Button>
      ) : (
        action ?? null
      )}

      {hints ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{hints}</div>
      ) : null}
    </div>
  );
}
