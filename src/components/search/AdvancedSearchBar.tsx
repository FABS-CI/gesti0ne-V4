import { useMemo, useState } from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AdvancedFilters = {
  reference?: string;
  commande?: string;
  client?: string;
  telephone?: string;
  commercial?: string;
  ville?: string;
  dateDu?: string;
  dateAu?: string;
  montantMin?: number;
  montantMax?: number;
};

export type AdvancedFilterField =
  "reference" | "commande" | "client" | "telephone" | "commercial" | "ville" | "dates" | "montants";

const FIELD_LABELS: Record<keyof AdvancedFilters, string> = {
  reference: "N° / Référence",
  commande: "N° Commande (BC)",
  client: "Client",
  telephone: "Téléphone",
  commercial: "Représentant",
  ville: "Ville",
  dateDu: "Date début",
  dateAu: "Date fin",
  montantMin: "Montant min",
  montantMax: "Montant max",
};

function countActive(f: AdvancedFilters): number {
  let n = 0;
  for (const k of Object.keys(f) as (keyof AdvancedFilters)[]) {
    const v = f[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") n += 1;
  }
  return n;
}

export function AdvancedSearchBar({
  fields,
  value,
  onChange,
}: {
  fields: AdvancedFilterField[];
  value: AdvancedFilters;
  onChange: (v: AdvancedFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilters>(value);
  const activeCount = useMemo(() => countActive(value), [value]);

  const has = (f: AdvancedFilterField) => fields.includes(f);

  function patch(p: Partial<AdvancedFilters>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function apply() {
    const cleaned: AdvancedFilters = {};
    for (const [k, v] of Object.entries(draft) as [keyof AdvancedFilters, unknown][]) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (typeof v === "number" && Number.isNaN(v)) continue;
      (cleaned as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
    }
    onChange(cleaned);
    setOpen(false);
  }

  function reset() {
    setDraft({});
    onChange({});
    setOpen(false);
  }

  function clearChip(k: keyof AdvancedFilters) {
    const next = { ...value };
    delete next[k];
    onChange(next);
    setDraft(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setDraft(value);
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtres avancés
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,520px)] space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {has("reference") && (
              <Field label={FIELD_LABELS.reference}>
                <Input
                  value={draft.reference ?? ""}
                  onChange={(e) => patch({ reference: e.target.value })}
                  placeholder="CMD-2026-..."
                />
              </Field>
            )}
            {has("commande") && (
              <Field label={FIELD_LABELS.commande}>
                <Input
                  value={draft.commande ?? ""}
                  onChange={(e) => patch({ commande: e.target.value })}
                  placeholder="CMD-..."
                />
              </Field>
            )}
            {has("client") && (
              <Field label={labels?.client ?? FIELD_LABELS.client}>
                <Input
                  value={draft.client ?? ""}
                  onChange={(e) => patch({ client: e.target.value })}
                  placeholder="Nom client"
                />
              </Field>
            )}
            {has("telephone") && (
              <Field label={FIELD_LABELS.telephone}>
                <Input
                  value={draft.telephone ?? ""}
                  onChange={(e) => patch({ telephone: e.target.value })}
                  placeholder="+225..."
                />
              </Field>
            )}
            {has("commercial") && (
              <Field label={FIELD_LABELS.commercial}>
                <Input
                  value={draft.commercial ?? ""}
                  onChange={(e) => patch({ commercial: e.target.value })}
                  placeholder="Nom représentant"
                />
              </Field>
            )}
            {has("ville") && (
              <Field label={FIELD_LABELS.ville}>
                <Input
                  value={draft.ville ?? ""}
                  onChange={(e) => patch({ ville: e.target.value })}
                  placeholder="Abidjan, Bouaké…"
                />
              </Field>
            )}
            {has("dates") && (
              <>
                <Field label={FIELD_LABELS.dateDu}>
                  <Input
                    type="date"
                    value={draft.dateDu ?? ""}
                    onChange={(e) => patch({ dateDu: e.target.value })}
                  />
                </Field>
                <Field label={FIELD_LABELS.dateAu}>
                  <Input
                    type="date"
                    value={draft.dateAu ?? ""}
                    onChange={(e) => patch({ dateAu: e.target.value })}
                  />
                </Field>
              </>
            )}
            {has("montants") && (
              <>
                <Field label={FIELD_LABELS.montantMin}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={draft.montantMin ?? ""}
                    onChange={(e) =>
                      patch({
                        montantMin: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label={FIELD_LABELS.montantMax}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={draft.montantMax ?? ""}
                    onChange={(e) =>
                      patch({
                        montantMax: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
            </Button>
            <Button size="sm" onClick={apply}>
              Appliquer les filtres
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(value) as (keyof AdvancedFilters)[]).map((k) => {
            const v = value[k];
            if (v === undefined || v === null || String(v).trim() === "") return null;
            return (
              <Badge key={k} variant="secondary" className="gap-1 pl-2 pr-1">
                <span className="text-xs">
                  <span className="text-muted-foreground">{FIELD_LABELS[k]}:</span> {String(v)}
                </span>
                <button
                  type="button"
                  onClick={() => clearChip(k)}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label={`Retirer ${FIELD_LABELS[k]}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Construit un fragment lisible décrivant les filtres actifs — utilisé dans
 * l'en-tête des exports PDF pour rappeler les critères appliqués.
 */
export function describeFilters(f: AdvancedFilters, labels?: Partial<Record<keyof AdvancedFilters, string>>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(f) as (keyof AdvancedFilters)[]) {
    const v = f[k];
    if (v === undefined || v === null || String(v).trim() === "") continue;
    out.push(`${labels?.[k] ?? FIELD_LABELS[k]}: ${v}`);
  }
  return out;
}
