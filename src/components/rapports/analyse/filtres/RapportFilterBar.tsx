import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRapportFacets, type RapportFilters } from "@/lib/rapports-api";
import { cleanSpaces, titleCaseVille } from "@/lib/rapports-labels";
import { groupNiveaux } from "@/lib/rapports-niveaux";
import { PeriodeFilter } from "./PeriodeFilter";
import { MultiFilter } from "./MultiFilter";
import { ActiveFilters, type MultiKey } from "./ActiveFilters";
import type { FilterSection } from "./FilterOptionList";

const flat = (values: string[], fmt: (v: string) => string = cleanSpaces): FilterSection[] => [
  { options: values.map((v) => ({ value: v, label: fmt(v) })) },
];

export function RapportFilterBar({
  value,
  onChange,
  compare,
  onCompareChange,
  nbProduits,
  nbClients,
}: {
  value: RapportFilters;
  onChange: (v: RapportFilters) => void;
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  nbProduits?: number;
  nbClients?: number;
}) {
  const { data: facets } = useQuery({
    queryKey: ["rapport-facets"],
    queryFn: getRapportFacets,
    staleTime: 5 * 60_000,
  });

  const sections = useMemo(() => {
    const niveaux = groupNiveaux(facets?.niveaux ?? []).map((g) => ({
      title: g.cycle,
      options: g.items.map((v) => ({ value: v, label: cleanSpaces(v) })),
    }));
    return {
      niveaux,
      categories: flat(facets?.categories ?? []),
      types: flat(facets?.types ?? []),
      villes: flat(facets?.villes ?? [], titleCaseVille),
      produits: [
        { options: (facets?.produits ?? []).map((p) => ({ value: p.id, label: p.titre })) },
      ],
    } satisfies Record<MultiKey, FilterSection[]>;
  }, [facets]);

  const labelOf = (k: MultiKey) => (v: string) =>
    k === "produits"
      ? (facets?.produits.find((p) => p.id === v)?.titre ?? "Produit")
      : k === "villes"
        ? titleCaseVille(v)
        : cleanSpaces(v);

  const setKey = (k: MultiKey, next: string[]) =>
    onChange({ ...value, [k]: next.length ? next : undefined });

  const hasAny =
    !!(value.from || value.to) ||
    (["niveaux", "categories", "types", "villes", "produits"] as const).some(
      (k) => (value[k]?.length ?? 0) > 0,
    );

  // Ctrl+Maj+F : effacer tous les filtres.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onChange({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange]);

  const filters: [MultiKey, string][] = [
    ["niveaux", "Niveau"],
    ["categories", "Catégorie"],
    ["types", "Type de client"],
    ["villes", "Ville"],
    ["produits", "Produit"],
  ];

  return (
    <div className="sticky top-0 z-20 -mx-1 border-b bg-background px-1 pb-2 pt-2">
      <div
        role="toolbar"
        aria-label="Filtres du rapport"
        className="flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      >
        <PeriodeFilter
          from={value.from}
          to={value.to}
          compare={compare}
          onChange={(p) => onChange({ ...value, ...p })}
          onCompareChange={onCompareChange}
        />
        {filters.map(([k, label]) => (
          <MultiFilter
            key={k}
            label={label}
            sections={sections[k]}
            selected={value[k] ?? []}
            onChange={(next) => setKey(k, next)}
            labelOf={labelOf(k)}
          />
        ))}
        {hasAny && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 shrink-0 text-muted-foreground md:h-9"
            onClick={() => onChange({})}
            title="Ctrl+Maj+F"
          >
            Effacer tout
          </Button>
        )}
      </div>
      <ActiveFilters
        value={value}
        labels={Object.fromEntries(filters) as Record<MultiKey, string>}
        labelOf={labelOf}
        onRemove={(k) => setKey(k, [])}
        nbProduits={nbProduits}
        nbClients={nbClients}
      />
    </div>
  );
}
