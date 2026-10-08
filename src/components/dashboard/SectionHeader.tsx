import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type To = "/commandes" | "/produits" | "/rh-dashboard" | "/compta-dashboard";

interface Props {
  title: string;
  action?: { label: string; to: To };
  children: ReactNode;
}

export function SectionHeader({ title, action, children }: Props) {
  return (
    <section className="space-y-3 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}
