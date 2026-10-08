import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Couleur = état, jamais décoration. Voir docs/ui-refonte/DESIGN-RULES.md. */
export type KpiTone = "neutral" | "destructive" | "warning" | "success";

export type KpiTo =
  | "/commandes"
  | "/factures"
  | "/produits"
  | "/stock"
  | "/employes"
  | "/conges"
  | "/contrats"
  | "/paie"
  | "/comptabilite";

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: "text-foreground",
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
};

interface Props {
  label: string;
  value: ReactNode;
  /** Valeur numérique nulle : affichée en gris, jamais colorée. */
  isZero?: boolean;
  tone?: KpiTone;
  /** Libellé texte accompagnant une valeur colorée (la couleur ne porte pas le sens seule). */
  stateLabel?: string;
  secondary?: string;
  to?: KpiTo;
}

export function KpiCard({
  label,
  value,
  isZero = false,
  tone = "neutral",
  stateLabel,
  secondary,
  to,
}: Props) {
  const effectiveTone: KpiTone = isZero ? "neutral" : tone;
  const valueClass = isZero ? "text-muted-foreground" : TONE_CLASS[effectiveTone];
  const showState = !isZero && effectiveTone !== "neutral" && stateLabel;

  const body = (
    <>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {(showState || secondary) && (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {showState && (
            <span className={`font-medium ${TONE_CLASS[effectiveTone]}`}>
              <span
                aria-hidden
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle"
              />
              {stateLabel}
            </span>
          )}
          {secondary && <span>{secondary}</span>}
        </p>
      )}
    </>
  );

  const base = "block min-h-[88px] rounded-lg border bg-card p-4";
  if (to) {
    return (
      <Link
        to={to}
        className={`${base} transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
