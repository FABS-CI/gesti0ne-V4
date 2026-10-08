import { Button } from "@/components/ui/button";
import { PERIODES, type Periode } from "@/lib/dashboard-helpers";

interface Props {
  periode: Periode;
  onPeriode: (p: Periode) => void;
  hasData: boolean;
  exporting: null | "png" | "pdf";
  onExportPng: () => void;
  onExportPdf: () => void;
}

export function DashboardHeader({ periode, onPeriode }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <h1 className="sr-only">Tableau de bord</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Période affichée"
          className="flex items-center gap-1 rounded-lg border bg-card p-1"
        >
          {PERIODES.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={periode === p.value ? "default" : "ghost"}
              onClick={() => onPeriode(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
