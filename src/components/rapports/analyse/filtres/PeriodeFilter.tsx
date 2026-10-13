import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterTrigger } from "./FilterTrigger";
import {
  PERIODE_PRESETS,
  computeRapportPeriode,
  formatPeriodeLabel,
  matchPreset,
} from "@/lib/rapports-periode";
import { cn } from "@/lib/utils";

export function PeriodeFilter({
  from,
  to,
  compare,
  onChange,
  onCompareChange,
}: {
  from?: string;
  to?: string;
  compare: boolean;
  onChange: (p: { from?: string; to?: string }) => void;
  onCompareChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = matchPreset(from, to);
  const hasPeriod = !!(from || to);

  return (
    <FilterTrigger
      label="Période"
      summary={hasPeriod ? formatPeriodeLabel(from, to) : undefined}
      open={open}
      onOpenChange={setOpen}
      width="w-72"
    >
      <div role="radiogroup" aria-label="Raccourcis de période" className="py-1">
        {PERIODE_PRESETS.map((p) => {
          const on = current === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onChange(computeRapportPeriode(p.key));
                setOpen(false);
              }}
              className={cn(
                "flex h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none md:h-9",
                on && "font-medium text-primary",
              )}
            >
              <Check className={cn("h-4 w-4", !on && "invisible")} strokeWidth={1.5} aria-hidden />
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!hasPeriod}
          onClick={() => {
            onChange({ from: undefined, to: undefined });
            setOpen(false);
          }}
          className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted md:h-9"
        >
          <Check className={cn("h-4 w-4", hasPeriod && "invisible")} strokeWidth={1.5} aria-hidden />
          Toute la période
        </button>
      </div>
      <div className="space-y-2 border-t p-3">
        <p className="text-xs font-semibold text-muted-foreground">Personnalisé</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="periode-du" className="text-xs">Du</Label>
            <Input
              id="periode-du"
              type="date"
              value={from ?? ""}
              max={to}
              onChange={(e) => onChange({ from: e.target.value || undefined, to })}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="periode-au" className="text-xs">Au</Label>
            <Input
              id="periode-au"
              type="date"
              value={to ?? ""}
              min={from}
              onChange={(e) => onChange({ from, to: e.target.value || undefined })}
              className="h-9"
            />
          </div>
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 border-t px-3 text-sm md:min-h-10">
        <Checkbox
          checked={compare}
          disabled={!from || !to}
          onCheckedChange={(c) => onCompareChange(c === true)}
        />
        Comparer à la période précédente
      </label>
    </FilterTrigger>
  );
}
