import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success-soft-foreground", dot: "bg-success-soft-foreground" },
  warning: { pill: "bg-warning-soft text-warning-soft-foreground", dot: "bg-warning-soft-foreground" },
  danger: { pill: "bg-danger-soft text-danger-soft-foreground", dot: "bg-danger-soft-foreground" },
  info: { pill: "bg-info-soft text-info-soft-foreground", dot: "bg-info-soft-foreground" },
  neutral: { pill: "bg-neutral-soft text-neutral-soft-foreground", dot: "bg-neutral-soft-foreground" },
};

/** Pastille de statut : fond doux, texte foncé et petit point de la même teinte. */
export function StatusPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        t.pill,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}
