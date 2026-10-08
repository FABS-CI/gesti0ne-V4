import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  subtitle?: string;
  backTo: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
};

export function RhPageHeader({ title, subtitle, backTo, crumbs, actions }: Props) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      {crumbs && crumbs.length > 0 && (
        <nav
          aria-label="Fil d'Ariane"
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          <Link to="/rh-dashboard" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="h-3 w-3" aria-hidden />
            <span>RH</span>
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3" aria-hidden />
              {c.to ? (
                <button
                  type="button"
                  onClick={() => navigate({ to: c.to! })}
                  className="hover:text-foreground"
                >
                  {c.label}
                </button>
              ) : (
                <span className="text-foreground">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour"
            onClick={() => navigate({ to: backTo })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="ds-page-title truncate">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </div>
  );
}
