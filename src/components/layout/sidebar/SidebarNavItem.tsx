import { Link } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Group, Item } from "./nav-data";

/**
 * Lien de navigation de second niveau (sans icône : l'icône est portée par le module).
 * État actif : fond légèrement relevé + filet bleu électrique de 2 px posé sur le
 * trait vertical du groupe — la signature visuelle de l'élément courant.
 */
export function SidebarNavItem({
  item,
  active,
}: {
  item: Item;
  group?: Group;
  active: boolean;
  activeText?: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;

  return (
    <li>
      <Link
        to={item.url}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
        className={cn(
          "sidebar-nav-item relative flex min-h-9 items-center rounded-lg px-3 py-2 text-[13px] leading-4",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 -left-[9px] w-0.5 rounded-full bg-sidebar-primary"
          />
        )}
        <span className="whitespace-normal">{item.title}</span>
      </Link>
    </li>
  );
}
