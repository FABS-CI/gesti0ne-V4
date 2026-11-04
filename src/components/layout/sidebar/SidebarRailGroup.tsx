import { cn } from "@/lib/utils";
import type { Group } from "./nav-data";

/** Icône d'un module dans la barre latérale réduite (rail). */
export function SidebarRailGroup({
  group,
  isActive,
  onOpen,
}: {
  group: Group;
  isActive: boolean;
  onOpen: () => void;
}) {
  const GroupIcon = group.groupIcon;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={group.label}
        title={group.label}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-md",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {isActive && (
          <span
            aria-hidden
            className="absolute inset-y-2 -left-2 w-0.5 rounded-full bg-sidebar-primary"
          />
        )}
        <GroupIcon strokeWidth={1.75} aria-hidden className="h-[18px] w-[18px]" />
      </button>
    </li>
  );
}
