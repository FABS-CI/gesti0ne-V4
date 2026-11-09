import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** En-tête de liste : surtitre gris, titre, actions à droite. */
export function ListPageHeader({
  overline,
  title,
  description,
  actions,
}: {
  overline: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="ds-overline">{overline}</p>
        <h1 className="ds-page-title mt-1 text-foreground">{title}</h1>
        {description ? <p className="ds-secondary mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Carte unique qui contient onglets, filtres, tableau et pagination. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[14px] border bg-card shadow-[var(--shadow-card)]",
        // le tableau interne n'a plus son propre cadre
        "[&_table]:min-w-[720px] [&_.relative.w-full]:rounded-none [&_.relative.w-full]:border-0",
        className,
      )}
    >
      {children}
    </section>
  );
}

export type ListTab = { value: string; label: string; count?: number };

/** Onglets de statut ; l'onglet actif est souligné en bleu pétrole. */
export function ListStatusTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: ListTab[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="tablist" className="custom-scrollbar flex gap-1 overflow-x-auto border-b px-4">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-2 py-3 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Barre de filtres placée sous les onglets. */
export function ListFilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">{children}</div>;
}

/** Pied de liste : « 1 à 10 sur N » et pagination. */
export function ListPagination({
  page,
  pageSize,
  total,
  noun,
  onPage,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (p: number) => void;
  disabled?: boolean;
}) {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from} à {to} sur {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || disabled} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || disabled}
          onClick={() => onPage(page + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}

/** Lignes squelettes pour le chargement d'un tableau. */
export function ListSkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 px-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Retire le cadre propre d'un tableau enfant direct placé dans une ListCard. */
export const INNER_FRAME_RESET =
  "[&>.rounded-lg.border]:rounded-none [&>.rounded-lg.border]:border-0";
