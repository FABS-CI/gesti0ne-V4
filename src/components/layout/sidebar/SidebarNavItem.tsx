import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Group, Item } from "./nav-data";
import { useApprobationsCount } from "@/hooks/use-approbations-count";

function BadgeApprobations() {
  const { total, critiques } = useApprobationsCount();
  if (!total) return null;
  const isCritical = critiques > 0;
  return (
    <span
      aria-label={`${total} approbation${total > 1 ? "s" : ""} en attente`}
      className={cn(
        "ml-auto min-w-5 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums",
        isCritical ? "bg-destructive text-destructive-foreground" : "bg-warning text-sidebar-primary-foreground",
      )}
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}

export function SidebarNavItem({
  item,
  active,
}: {
  item: Item;
  group?: Group;
  active: boolean;
  activeText?: string;
}) {
  const Icon = item.icon;
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
        <Icon
          strokeWidth={1.75}
          aria-hidden
          className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/50")}
        />
        <span className="truncate">{item.title}</span>
        {item.badge === "approbations" ? <BadgeApprobations /> : null}
      </Link>
    </li>
  );
}
