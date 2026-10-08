import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageCrumb = { label: string; to?: string };

type Props = {
  /** Titre unique de la page (seul <h1>). */
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: PageCrumb[];
  badge?: ReactNode;
  actions?: ReactNode;
  /** Adresse de retour : affiche un bouton « Retour » à gauche du titre. */
  backTo?: string;
  className?: string;
};

export function PageHeader({ title, description, breadcrumbs, badge, actions, backTo, className }: Props) {
  return (
    <header className={cn("mb-4 space-y-2 border-b border-border pb-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="hover:text-foreground">{c.label}</Link>
              ) : (
                <span className="text-foreground">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {backTo && (
            <Link
              to={backTo}
              aria-label="Retour"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="ds-page-title truncate text-foreground">{title}</h1>
              {badge}
            </div>
            {description && <p className="ds-secondary mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
