import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PERIODES, type Periode } from "@/lib/dashboard-helpers";

interface Props {
  periode: Periode;
  onPeriode: (p: Periode) => void;
  hasData: boolean;
  exporting: null | "png" | "pdf";
  onExportPng: () => void;
  onExportPdf: () => void;
}

/** Libellés courts des périodes existantes (7, 30 et 90 jours glissants). */
const SEGMENT_LABEL: Record<Periode, string> = { "7": "Semaine", "30": "Mois", "90": "Trimestre" };

export function DashboardHeader({ periode, onPeriode }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="ds-overline">Pilotage</p>
        <h1 className="ds-page-title mt-1 text-foreground">Tableau de bord</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Période affichée"
          className="inline-flex items-center gap-0.5 rounded-[10px] bg-segment p-1"
        >
          {PERIODES.map((p) => {
            const active = periode === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={active}
                title={p.label}
                onClick={() => onPeriode(p.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-card font-medium text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SEGMENT_LABEL[p.value]}
              </button>
            );
          })}
        </div>
        <Button asChild>
          <Link to="/commandes/nouvelle">Nouvelle facture</Link>
        </Button>
      </div>
    </div>
  );
}
