import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { total: number; paye: number; du: number; retard?: number };

/** Bandeau de résumé : une carte, quatre cases séparées par un trait fin. */
export function FacturesKpis({ total, paye, du, retard = 0 }: Props) {
  const items = [
    { label: "Total facturé", value: total, valueClass: "" },
    { label: "Encaissé", value: paye, valueClass: "text-success" },
    { label: "Reste à encaisser", value: du, valueClass: "" },
    { label: "En retard", value: retard, valueClass: retard > 0 ? "text-destructive" : "" },
  ];
  return (
    <section className="grid overflow-hidden rounded-[14px] border bg-card shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "min-w-0 p-5",
            i > 0 && "border-t sm:border-t-0",
            i % 2 === 1 && "sm:border-l",
            i >= 2 && "sm:border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <p className="ds-label">{k.label}</p>
          <p className={cn("mt-1 truncate text-[22px] font-semibold tabular-nums tracking-tight", k.valueClass)}>
            {formatFCFA(k.value)}
          </p>
        </div>
      ))}
    </section>
  );
}
