import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCrmFacets, type CrmFilters } from "@/lib/crm-api";

type Props = {
  value: CrmFilters;
  onChange: (next: CrmFilters) => void;
};

export function CrmFiltersPanel({ value, onChange }: Props) {
  const { data: facets } = useQuery({
    queryKey: ["crm-facets"],
    queryFn: getCrmFacets,
    staleTime: 5 * 60_000,
  });

  const activeCount = useMemo(() => {
    let n = 0;
    if (value.produits?.length) n++;
    if (value.niveaux?.length) n++;
    if (value.categories?.length) n++;
    if (value.types?.length) n++;
    if (value.villes?.length) n++;
    if (value.representant) n++;
    if (value.from || value.to) n++;
    return n;
  }, [value]);

  const toggleIn = (
    key: "produits" | "niveaux" | "categories" | "types" | "villes",
    v: string,
  ) => {
    const arr = value[key] ?? [];
    const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
    onChange({ ...value, [key]: next.length ? next : undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filtres commerciaux
            {activeCount > 0 && (
              <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5">{activeCount}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,720px)] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MultiPicker
              label="Produits"
              options={(facets?.produits ?? []).map((p) => ({ value: p.id, label: p.titre }))}
              selected={value.produits ?? []}
              onToggle={(v) => toggleIn("produits", v)}
            />
            <MultiPicker
              label="Niveaux scolaires"
              options={(facets?.niveaux ?? []).map((n) => ({ value: n, label: n }))}
              selected={value.niveaux ?? []}
              onToggle={(v) => toggleIn("niveaux", v)}
            />
            <MultiPicker
              label="Catégories"
              options={(facets?.categories ?? []).map((c) => ({ value: c, label: c }))}
              selected={value.categories ?? []}
              onToggle={(v) => toggleIn("categories", v)}
            />
            <MultiPicker
              label="Types de client"
              options={(facets?.types ?? []).map((t) => ({ value: t, label: t }))}
              selected={value.types ?? []}
              onToggle={(v) => toggleIn("types", v)}
            />
            <MultiPicker
              label="Villes"
              options={(facets?.villes ?? []).map((v2) => ({ value: v2, label: v2 }))}
              selected={value.villes ?? []}
              onToggle={(v) => toggleIn("villes", v)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Représentant</Label>
              <Select
                value={value.representant ?? "__all__"}
                onValueChange={(v) =>
                  onChange({ ...value, representant: v === "__all__" ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous</SelectItem>
                  {(facets?.representants ?? []).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Période — du</Label>
              <Input
                type="date"
                value={value.from ?? ""}
                onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Période — au</Label>
              <Input
                type="date"
                value={value.to ?? ""}
                onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <QuickPeriod label="Aujourd'hui" onSelect={onChange} base={value} days={0} />
            <QuickPeriod label="7 jours" onSelect={onChange} base={value} days={7} />
            <QuickPeriod label="Ce mois" onSelect={onChange} base={value} month />
            <QuickPeriod label="Cette année" onSelect={onChange} base={value} year />
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onChange({ q: value.q, actif: value.actif })}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Réinitialiser
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.produits?.map((id) => (
            <ChipRemove
              key={id}
              label={facets?.produits.find((p) => p.id === id)?.titre ?? id}
              onRemove={() => toggleIn("produits", id)}
            />
          ))}
          {value.niveaux?.map((n) => (
            <ChipRemove key={n} label={`Niveau : ${n}`} onRemove={() => toggleIn("niveaux", n)} />
          ))}
          {value.categories?.map((c) => (
            <ChipRemove key={c} label={`Cat. : ${c}`} onRemove={() => toggleIn("categories", c)} />
          ))}
          {value.types?.map((t) => (
            <ChipRemove key={t} label={`Type : ${t}`} onRemove={() => toggleIn("types", t)} />
          ))}
          {value.villes?.map((v) => (
            <ChipRemove key={v} label={`Ville : ${v}`} onRemove={() => toggleIn("villes", v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 200),
    [options, q],
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {selected.length > 0 && <span className="text-primary">({selected.length})</span>}
      </Label>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher…"
        className="h-8"
      />
      <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-1">
        {filtered.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">Aucun résultat</p>
        )}
        {filtered.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted ${
                on ? "bg-primary/10 text-primary" : ""
              }`}
            >
              <span
                className={`inline-block h-3 w-3 shrink-0 rounded border ${
                  on ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}
              />
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipRemove({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1">
      <span className="max-w-[180px] truncate">{label}</span>
      <button type="button" onClick={onRemove} className="opacity-70 hover:opacity-100">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function QuickPeriod({
  label,
  onSelect,
  base,
  days,
  month,
  year,
}: {
  label: string;
  onSelect: (v: CrmFilters) => void;
  base: CrmFilters;
  days?: number;
  month?: boolean;
  year?: boolean;
}) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const apply = () => {
    const now = new Date();
    let from: Date;
    if (month) from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (year) from = new Date(now.getFullYear(), 0, 1);
    else {
      from = new Date(now);
      from.setDate(now.getDate() - (days ?? 0));
    }
    onSelect({ ...base, from: iso(from), to: iso(now) });
  };
  return (
    <Button variant="outline" size="sm" onClick={apply}>
      {label}
    </Button>
  );
}