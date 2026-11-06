import { useCountUp } from "@/lib/count-up";

interface AnimatedNumberProps {
  value: number;
  /** Mise en forme du nombre (FCFA, pourcentage…). Par défaut : entier. */
  format?: (n: number) => string;
  /** Décimales conservées pendant l'animation (ex. 1 pour un taux). */
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const affiche = useCountUp(value, decimals);
  if (affiche === value) return <span className={className}>{format(value)}</span>;
  return (
    <span className={className}>
      <span aria-hidden="true">{format(affiche)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
