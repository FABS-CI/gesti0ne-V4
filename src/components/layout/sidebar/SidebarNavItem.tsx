import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Group, Item } from "./nav-data";

export function SidebarNavItem({
  item,
  active,
}: {
  item: Item;
  group?: Group;
  active: boolean;
  activeText?: string;
}) {
  return (
    <li>
      <Link
        to={item.url}
        aria-current={active ? "page" : undefined}
        className={cn(
          "sidebar-nav-item relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm lg:min-h-9",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 -left-2 w-0.5 rounded-full bg-sidebar-primary"
          />
        )}
        <span className="truncate">{item.title}</span>
      </Link>
    </li>
  );
}
