import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { formatFCFA } from "@/lib/format";

type Props = { total: number; paye: number; du: number };

export function FacturesKpis({ total, paye, du }: Props) {
  const items = [
    {
      label: "Total facturé",
      value: total,
      icon: Wallet,
      color: "#0EA5E9",
      valueClass: "",
      tone: "",
    },
    {
      label: "Encaissé",
      value: paye,
      icon: CheckCircle2,
      color: "#10B981",
      valueClass: "text-success",
      tone: "border-success/30",
    },
    {
      label: "Reste dû",
      value: du,
      icon: AlertCircle,
      color: "#EF4444",
      valueClass: "text-destructive",
      tone:
        du > 0
          ? "border-destructive/40"
          : "",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((k) => (
        <Card
          key={k.label}
          className={`relative overflow-hidden transition-colors hover:border-primary/40 ${k.tone}`}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: k.color }}
          />
          <CardContent className="flex items-center justify-between gap-3 p-4 pl-5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`truncate text-xl font-bold tracking-tight ${k.valueClass}`}>
                {formatFCFA(k.value)}
              </p>
            </div>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: k.color }}
            >
              <k.icon className="h-4 w-4" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
