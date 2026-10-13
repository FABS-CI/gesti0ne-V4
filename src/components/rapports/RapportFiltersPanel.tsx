import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { getRapportFacets, type RapportFilters } from "@/lib/rapports-api";
import { PERIODE_PRESETS, computeRapportPeriode } from "@/lib/rapports-periode";
import { titleCaseVille, cleanSpaces } from "@/lib/rapports-labels";

const FILTER_LABELS = {
  niveaux: "Niveau",
  categories: "Catégorie",
  types: "Type de client",
  villes: "Ville",
  produits: "Produit",
} as const;

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
      (value[k] ?? []).forEach((v) => {
        const shown =
          k === "produits"
            ? (facets?.produits.find((p) => p.id === v)?.titre ?? "Produit")
            : k === "villes"
              ? titleCaseVille(v)
              : cleanSpaces(v);
        chips.push({ key: k, label: `${FILTER_LABELS[k]} : ${shown}`, value: v });
      });
    });
    return chips;
  }, [value, facets]);

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
            {PERIODE_PRESETS.map((p) => (
              <Button
                key={p.key}
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onChange({ ...value, ...computeRapportPeriode(p.key) })}
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
            format={titleCaseVille}
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
                {c.label} <X className="ml-1 h-3 w-3" aria-label="Retirer ce filtre" />
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
  format = cleanSpaces,
}: {
  label: string;
  items: string[];
  active: string[];
  onToggle: (v: string) => void;
  format?: (v: string) => string;
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
              {format(it)}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}