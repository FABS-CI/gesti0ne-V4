import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";
import { checkDateColis, todayISO } from "@/lib/date-colis-warn";

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  colisCount: number;
};

/**
 * Sélecteur "Date colis" avec :
 *  - raccourcis Hier / Aujourd'hui / Demain
 *  - message d'aide expliquant J-1 / J / J+1
 *  - bandeau warn/erreur (checkDateColis)
 */
export function DateColisPicker({ value, onChange, colisCount }: Props) {
  const w = checkDateColis(value, colisCount);
  const today = todayISO();
  const suggested = w.blocking && w.level === "error" ? today : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Date colis</Label>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-36"
        />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={value === shift(-1) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => onChange(shift(-1))}
          >
            Hier (J-1)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === today ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => onChange(today)}
          >
            Aujourd'hui
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === shift(1) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => onChange(shift(1))}
          >
            Demain (J+1)
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sélectionnez la date de <b>colisage</b> des colis à charger. J = tournée du jour, J-1 =
        rattrapage de la veille, J+1 = tournée préparée à l'avance.
      </p>
      {w.message && (
        <div
          className={
            "rounded-md border px-3 py-2 text-xs flex items-start gap-2 " +
            (w.level === "error"
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : w.level === "warn"
                ? "border-warning/50 bg-warning/10 text-warning"
                : "border-muted bg-muted/40 text-muted-foreground")
          }
        >
          {w.level === "error" || w.level === "warn" ? (
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">
            {w.message}
            {suggested && (
              <>
                {" "}
                <button
                  type="button"
                  className="underline underline-offset-2 font-medium"
                  onClick={() => onChange(suggested)}
                >
                  Utiliser aujourd'hui ({suggested})
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
