import { formatNumber } from "@/lib/format";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => formatNumber(n);

/**
 * Pagination partagée pour les grosses listes (contrôle serveur page/pageSize).
 * Sans `onPageSizeChange`, rend la version minimale et rien si total ≤ pageSize.
 * Avec `onPageSizeChange`, ajoute le choix du nombre de lignes, la plage
 * « 51–100 sur 1 248 » et le saut de page.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jump, setJump] = useState("");
  if (!onPageSizeChange && total <= pageSize) return null;

  if (!onPageSizeChange) {
    return (
      <div className="flex items-center justify-end gap-2 pt-2">
        <span className="text-sm text-muted-foreground">
          Page {page} / {totalPages} · {total} éléments
        </span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Préc.
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Suiv.
        </Button>
      </div>
    );
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const go = () => {
    const n = Number(jump);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) onPageChange(n);
    setJump("");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <label htmlFor="tp-size" className="text-xs text-muted-foreground">
          Lignes par page
        </label>
        <select
          id="tp-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="tabular-nums text-muted-foreground">
          {fmt(start)}–{fmt(end)} sur {fmt(total)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Précédent
        </Button>
        <span className="tabular-nums">
          Page {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Suivant
        </Button>
        <Input
          aria-label="Aller à la page"
          placeholder="Page"
          inputMode="numeric"
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="h-8 w-16"
        />
        <Button variant="outline" size="sm" onClick={go} disabled={!jump}>
          Aller
        </Button>
      </div>
    </div>
  );
}
