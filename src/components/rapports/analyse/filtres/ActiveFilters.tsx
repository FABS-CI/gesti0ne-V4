import { X } from "lucide-react";
import type { RapportFilters } from "@/lib/rapports-api";
import { formatNumber } from "@/lib/format";

export type MultiKey = "niveaux" | "categories" | "types" | "villes" | "produits";
const KEYS: MultiKey[] = ["niveaux", "categories", "types", "villes", "produits"];
const MAX_SHOWN = 3;

/** Puces lisibles des filtres actifs, affichées seulement s'il y en a. */
export function ActiveFilters({
  value,
  labels,
  labelOf,
  onRemove,
  nbProduits,
  nbClients,
}: {
  value: RapportFilters;
  labels: Record<MultiKey, string>;
  labelOf: (k: MultiKey) => (v: string) => string;
  onRemove: (k: MultiKey) => void;
  nbProduits?: number;
  nbClients?: number;
}) {
  const active = KEYS.filter((k) => (value[k]?.length ?? 0) > 0);
  if (!active.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {active.map((k) => {
        const names = (value[k] ?? []).map(labelOf(k));
        const shown =
          names.length > MAX_SHOWN
            ? `${names.slice(0, MAX_SHOWN).join(", ")} +${names.length - MAX_SHOWN}`
            : names.join(", ");
        return (
          <button
            key={k}
            type="button"
            onClick={() => onRemove(k)}
            title={names.join(", ")}
            aria-label={`Retirer le filtre ${labels[k]} : ${names.join(", ")}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border bg-muted/50 px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-muted-foreground">{labels[k]} :</span>
            <span className="max-w-[16rem] truncate font-medium">{shown}</span>
            <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </button>
        );
      })}
      {(nbProduits != null || nbClients != null) && (
        <span className="ml-auto tabular-nums text-muted-foreground" aria-live="polite">
          {nbProduits != null && `${formatNumber(nbProduits)} produit${nbProduits > 1 ? "s" : ""}`}
          {nbProduits != null && nbClients != null && " · "}
          {nbClients != null && `${formatNumber(nbClients)} client${nbClients > 1 ? "s" : ""}`}
        </span>
      )}
    </div>
  );
}
