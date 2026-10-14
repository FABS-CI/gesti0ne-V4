import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { TablePagination } from "@/components/layout/TablePagination";
import { SkeletonTable } from "@/components/ui/skeletons";
import { supabase } from "@/integrations/supabase/client";
import type { ProduitLigneRapport } from "@/lib/rapports-api";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COLS,
  OPTIONAL_COLS,
  SORT_KEY,
  loadColPrefs,
  saveColPrefs,
  type ColId,
  type ColPrefs,
} from "@/lib/rapports-produits-colonnes";

type Props = {
  rows: ProduitLigneRapport[];
  total: number;
  isLoading: boolean;
  tri: string;
  sens: "asc" | "desc";
  onSort: (key: string) => void;
  page: number;
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  onOpen: (row: ProduitLigneRapport) => void;
  emptyAction?: ReactNode;
};

const fmtN = (n: number) => Number(n ?? 0).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
const fmtPct = (n: number) => `${Number(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

const LABEL: Record<ColId, string> = {
  produit: "Produit",
  niveau: "Niveau",
  qte: "Qté vendue",
  ca: "CA facturé",
  encaisse: "CA encaissé",
  reste: "Reste à encaisser",
  pct: "% du CA",
  stock: "Stock",
  ...Object.fromEntries(OPTIONAL_COLS),
} as Record<ColId, string>;

/** Seuils d'alerte des produits affichés (lecture seule, hors RPC). */
function useSeuils(ids: string[]) {
  return useQuery({
    queryKey: ["rap-seuils", ids],
    enabled: ids.length > 0,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("produits").select("id, seuil_alerte").in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id as string, Number(p.seuil_alerte ?? 0)]));
    },
  });
}

function moveFocus(e: KeyboardEvent<HTMLElement>, onEnter: () => void) {
  const el = e.currentTarget;
  if (e.key === "Enter") onEnter();
  else if (e.key === "ArrowDown") {
    e.preventDefault();
    (el.nextElementSibling as HTMLElement | null)?.focus();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    (el.previousElementSibling as HTMLElement | null)?.focus();
  }
}

export function ProduitsTab(p: Props) {
  const [prefs, setPrefs] = useState<ColPrefs>({ extra: [], densite: "confortable" });
  useEffect(() => setPrefs(loadColPrefs()), []);
  const update = (next: ColPrefs) => {
    setPrefs(next);
    saveColPrefs(next);
  };
  const cols: ColId[] = [
    ...DEFAULT_COLS,
    ...OPTIONAL_COLS.map(([c]) => c).filter((c) => prefs.extra.includes(c)),
  ];
  const seuils = useSeuils(p.rows.map((r) => r.produit_id)).data;
  const isLow = (r: ProduitLigneRapport) => {
    const s = seuils?.get(r.produit_id) ?? 0;
    return s > 0 && r.stock_actuel < s;
  };
  const maxPct = Math.max(1, ...p.rows.map((r) => Number(r.pct_ca) || 0));
  const rowH = prefs.densite === "compact" ? "h-9" : "h-10";

  const cell = (c: ColId, r: ProduitLigneRapport): ReactNode => {
    switch (c) {
      case "produit":
        return (
          <div className="min-w-[220px] max-w-[320px] leading-tight">
            <div className="font-mono text-xs text-muted-foreground">{r.code ?? "—"}</div>
            <div className="line-clamp-2 text-sm">{r.titre}</div>
          </div>
        );
      case "niveau":
        return <span className="whitespace-nowrap text-sm">{r.niveau ?? "—"}</span>;
      case "qte": return fmtN(r.qte_vendue);
      case "ca": return <span className="font-medium">{formatFCFA(r.ca)}</span>;
      case "encaisse": return formatFCFA(r.ca_encaisse ?? 0);
      case "reste":
        return (
          <span className={cn((r.reste_a_encaisser ?? 0) > 0 && "text-warning")}>
            {formatFCFA(r.reste_a_encaisser ?? 0)}
          </span>
        );
      case "pct":
        return (
          <div className="flex min-w-[90px] items-center justify-end gap-2">
            <div className="h-1 w-12 rounded-full bg-muted" aria-hidden>
              <div className="h-1 rounded-full bg-primary" style={{ width: `${(Number(r.pct_ca) / maxPct) * 100}%` }} />
            </div>
            {fmtPct(r.pct_ca)}
          </div>
        );
      case "stock":
        return isLow(r) ? (
          <span className="whitespace-nowrap text-destructive">
            {fmtN(r.stock_actuel)} <span className="text-xs">Stock bas</span>
          </span>
        ) : (
          fmtN(r.stock_actuel)
        );
      case "pu": return formatFCFA(r.prix_unitaire);
      case "qte_fact": return fmtN(r.qte_facturee);
      case "nb_fact": return fmtN(r.nb_factures);
      case "nb_clients": return fmtN(r.nb_clients);
      case "remises": return formatFCFA(r.remises);
      case "retours": return fmtN(r.qte_retournee);
      case "stock_init": return fmtN(r.stock_initial);
      case "stock_rest": return fmtN(r.stock_restant);
      case "rang": return fmtN(r.rang);
    }
  };

  const empty = (
    <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
      <p>Aucune vente sur cette période pour les filtres choisis.</p>
      {p.emptyAction}
    </div>
  );

  const cards = p.isLoading ? (
    <SkeletonTable rows={6} cols={2} />
  ) : p.rows.length === 0 ? (
    empty
  ) : (
    <ul className="divide-y divide-border">
      {p.rows.map((r) => (
        <li
          key={r.produit_id}
          tabIndex={0}
          onClick={() => p.onOpen(r)}
          onKeyDown={(e) => moveFocus(e, () => p.onOpen(r))}
          className="cursor-pointer space-y-1 p-3 focus-visible:bg-muted focus-visible:outline-none"
        >
          {cell("produit", r)}
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div><div className="text-muted-foreground">CA</div>{formatFCFA(r.ca)}</div>
            <div><div className="text-muted-foreground">Qté</div>{fmtN(r.qte_vendue)}</div>
            <div><div className="text-muted-foreground">Stock</div>{cell("stock", r)}</div>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-end border-b px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden md:inline-flex">
              <Columns3 className="h-4 w-4" strokeWidth={1.5} />
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Colonnes supplémentaires</DropdownMenuLabel>
            {OPTIONAL_COLS.map(([c, l]) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={prefs.extra.includes(c)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) =>
                  update({ ...prefs, extra: on ? [...prefs.extra, c] : prefs.extra.filter((x) => x !== c) })
                }
              >
                {l}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Densité</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={prefs.densite}
              onValueChange={(v) => update({ ...prefs, densite: v === "compact" ? "compact" : "confortable" })}
            >
              <DropdownMenuRadioItem value="confortable">Confortable</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ResponsiveTable stickyFirstCol mobileCards={cards} className="max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => {
                const key = SORT_KEY[c];
                const active = !!key && p.tri === key && (c !== "pct" || p.tri === "ca");
                const label = LABEL[c];
                return (
                  <TableHead
                    key={c}
                    aria-sort={active ? (p.sens === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("whitespace-nowrap text-xs", c !== "produit" && c !== "niveau" && "text-right")}
                  >
                    {key ? (
                      <button type="button" onClick={() => p.onSort(key)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {label}
                        <span aria-hidden className="text-muted-foreground">
                          {active ? (p.sens === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.isLoading ? (
              <TableRow>
                <TableCell colSpan={cols.length} className="p-3">
                  <SkeletonTable rows={8} cols={8} />
                </TableCell>
              </TableRow>
            ) : p.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length}>{empty}</TableCell>
              </TableRow>
            ) : (
              p.rows.map((r) => (
                <TableRow
                  key={r.produit_id}
                  tabIndex={0}
                  onClick={() => p.onOpen(r)}
                  onKeyDown={(e) => moveFocus(e, () => p.onOpen(r))}
                  className={cn(rowH, "cursor-pointer tabular-nums focus-visible:bg-muted focus-visible:outline-none")}
                >
                  {cols.map((c) => (
                    <TableCell
                      key={c}
                      className={cn(prefs.densite === "compact" ? "py-1" : "py-2", c !== "produit" && c !== "niveau" && "whitespace-nowrap text-right")}
                    >
                      {cell(c, r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>

      <div className="border-t p-3">
        <TablePagination
          page={p.page}
          pageSize={p.pageSize}
          total={p.total}
          onPageChange={p.onPage}
          onPageSizeChange={p.onPageSize}
        />
      </div>
    </div>
  );
}
