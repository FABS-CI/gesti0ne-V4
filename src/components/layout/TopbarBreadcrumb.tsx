import { useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { groups } from "./sidebar/nav-data";

/** Trouve le menu (groupe + élément) le plus précis correspondant à l'adresse. */
export function findNavTrail(path: string): { group: string; item: string } | null {
  let best: { group: string; item: string; len: number } | null = null;
  for (const g of groups) {
    for (const it of g.items) {
      if (it.url === "/" ? path === "/" : path === it.url || path.startsWith(`${it.url}/`)) {
        if (!best || it.url.length > best.len) best = { group: g.label, item: it.title, len: it.url.length };
      }
    }
  }
  return best ? { group: best.group, item: best.item } : null;
}

export function TopbarBreadcrumb() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const trail = findNavTrail(path);
  if (!trail) return null;
  return (
    <nav aria-label="Fil d'Ariane" className="hidden min-w-0 items-center gap-1 text-sm xl:flex">
      <span className="truncate text-muted-foreground">{trail.group}</span>
      {trail.item !== trail.group && (
        <>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span aria-current="page" className="truncate font-medium text-foreground">{trail.item}</span>
        </>
      )}
    </nav>
  );
}
