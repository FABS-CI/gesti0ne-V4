import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { getRapportFacets, type RapportFilters } from "@/lib/rapports-api";

const PRESETS: {
  label: string;
  days?: number;
  special?: "today" | "yesterday" | "year" | "quarter" | "month" | "week";
}[] = [
  { label: "Aujourd'hui", special: "today" },
  { label: "Hier", special: "yesterday" },
  { label: "7 jours", days: 7 },
  { label: "Cette semaine", special: "week" },
  { label: "Ce mois", special: "month" },
  { label: "Ce trimestre", special: "quarter" },
  { label: "Cette année", special: "year" },
  { label: "12 mois", days: 365 },
];

function computePreset(p: (typeof PRESETS)[number]): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p.special === "today") return { from: iso(now), to: iso(now) };
  if (p.special === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (p.special === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1);
    return { from: iso(d), to: iso(now) };
  }
  if (p.special === "month") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
  if (p.special === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(now.getFullYear(), q, 1)), to: iso(now) };
  }
  if (p.special === "year") {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - (p.days ?? 30));
  return { from: iso(start), to: iso(now) };
}

export function RapportFiltersPanel({
  value,
  onChange,
}: {
  value: RapportFilters;
  onChange: (v: RapportFilters) => void;
}) {
  const { data: facets } = useQuery({
    queryKey: ["rapport-facets"],
    queryFn: getRapportFacets,
    staleTime: 5 * 60_000,
  });

  type MultiValueKey = "niveaux" | "categories" | "types" | "villes" | "produits";

  const toggle = (key: MultiValueKey, item: string) => {
    const cur = value[key] ?? [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    onChange({ ...value, [key]: next.length ? next : undefined });
  };

  const activeChips = useMemo(() => {
    const chips: { key: MultiValueKey; label: string; value: string }[] = [];
    (["niveaux", "categories", "types", "villes", "produits"] as const).forEach((k) => {
      (value[k] ?? []).forEach((v) => chips.push({ key: k, label: `${k}: ${v}`, value: v }));
    });
    return chips;
  }, [value]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              value={value.from ?? ""}
              onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              value={value.to ?? ""}
              onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
              className="w-40"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onChange({ ...value, ...computePreset(p) })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange({})} className="ml-auto">
            <X className="mr-1 h-4 w-4" /> Réinitialiser
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <FacetGroup
            label="Niveau scolaire"
            items={facets?.niveaux ?? []}
            active={value.niveaux ?? []}
            onToggle={(v) => toggle("niveaux", v)}
          />
          <FacetGroup
            label="Catégorie"
            items={facets?.categories ?? []}
            active={value.categories ?? []}
            onToggle={(v) => toggle("categories", v)}
          />
          <FacetGroup
            label="Type client"
            items={facets?.types ?? []}
            active={value.types ?? []}
            onToggle={(v) => toggle("types", v)}
          />
          <FacetGroup
            label="Ville"
            items={facets?.villes ?? []}
            active={value.villes ?? []}
            onToggle={(v) => toggle("villes", v)}
          />
          <FacetGroup
            label="Produit"
            items={(facets?.produits ?? []).map((p) => p.titre)}
            active={(value.produits ?? [])
              .map((id) => facets?.produits.find((p) => p.id === id)?.titre)
              .filter((x): x is string => !!x)}
            onToggle={(titre) => {
              const p = facets?.produits.find((x) => x.titre === titre);
              if (!p) return;
              toggle("produits", p.id);
            }}
          />
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-t pt-3">
            <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
            {activeChips.map((c) => (
              <Badge
                key={`${c.key}-${c.value}`}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggle(c.key, c.value)}
              >
                {c.label} <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FacetGroup({
  label,
  items,
  active,
  onToggle,
}: {
  label: string;
  items: string[];
  active: string[];
  onToggle: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded border p-2">
        {items.map((it) => {
          const on = active.includes(it);
          return (
            <Badge
              key={it}
              variant={on ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onToggle(it)}
            >
              {it}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}