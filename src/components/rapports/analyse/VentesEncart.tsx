import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRapportFlop, getRapportTopProduits, type RapportFilters } from "@/lib/rapports-api";
import { formatFCFA, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SHORT = 5;

/** Encart repliable : meilleures ventes, jamais vendus, peu vendus. Chargé à l'ouverture. */
export function VentesEncart({ filters }: { filters: RapportFilters }) {
  const [open, setOpen] = useState(false);
  const topQ = useQuery({
    queryKey: ["rap-top", filters, 50],
    queryFn: () => getRapportTopProduits(filters, 50),
    enabled: open,
    staleTime: 60_000,
  });
  const flopQ = useQuery({
    queryKey: ["rap-flop", filters],
    queryFn: () => getRapportFlop(filters),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Meilleures ventes, produits jamais ou peu vendus
        <ChevronDown
          className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4 border-t p-4 md:grid-cols-3">
        <ListeCourte
          titre="Meilleures ventes"
          loading={topQ.isLoading}
          items={(topQ.data ?? []).map((p) => [p.titre, formatFCFA(p.ca)])}
        />
        <ListeCourte
          titre="Jamais vendus"
          loading={flopQ.isLoading}
          items={(flopQ.data?.jamais_vendus ?? []).map((p) => [p.titre, p.code ?? ""])}
          mono
        />
        <ListeCourte
          titre="Peu vendus"
          loading={flopQ.isLoading}
          items={(flopQ.data?.peu_vendus ?? []).map((p) => [p.titre, `${formatNumber(p.qte)} ex.`])}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ListeCourte({
  titre,
  items,
  loading,
  mono = false,
}: {
  titre: string;
  items: [string, string][];
  loading: boolean;
  mono?: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHORT);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        {titre} <span className="font-normal text-muted-foreground tabular-nums">({formatNumber(items.length)})</span>
      </h3>
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground">Aucun produit sur cette période.</p>
      ) : (
        <>
          <ul className={cn("divide-y rounded-md border text-sm", all && "max-h-72 overflow-y-auto")}>
            {shown.map(([l, v], i) => (
              <li key={l + i} className="flex items-center gap-2 px-3 py-2 tabular-nums">
                <span className="truncate">{l}</span>
                <span className={cn("ml-auto whitespace-nowrap text-muted-foreground", mono && "font-mono text-xs")}>
                  {v}
                </span>
              </li>
            ))}
          </ul>
          {items.length > SHORT && (
            <Button variant="link" size="sm" className="h-8 px-0" onClick={() => setAll(!all)}>
              {all ? "Réduire" : "Voir tout"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
