import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Group, Item } from "./nav-data";
import { SidebarNavItem } from "./SidebarNavItem";

type Section = { name: string | null; items: Item[] };

function groupBySection(items: Item[]): Section[] {
  const sections: Section[] = [];
  const index = new Map<string, Section>();
  for (const item of items) {
    const key = item.section ?? "__flat__";
    let bucket = index.get(key);
    if (!bucket) {
      bucket = { name: item.section ?? null, items: [] };
      index.set(key, bucket);
      sections.push(bucket);
    }
    bucket.items.push(item);
  }
  return sections;
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,visibility] duration-200 ease-out",
        open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export function SidebarNavGroup({
  group,
  isOpen,
  isActive,
  currentPath,
  onToggle,
}: {
  group: Group;
  isOpen: boolean;
  isActive: boolean;
  currentPath: string;
  onToggle: () => void;
}) {
  const GroupIcon = group.groupIcon;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          isActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <GroupIcon
            strokeWidth={1.75}
            aria-hidden
            className={cn("h-4 w-4 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60")}
          />
          <span className="truncate">{group.label}</span>
        </span>
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            "h-4 w-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <Collapse open={isOpen}>
        <ul className="mb-1 mt-1 ml-5 space-y-0.5 border-l border-sidebar-border pl-2">
          <NavSections group={group} currentPath={currentPath} parentOpen={isOpen} />
        </ul>
      </Collapse>
    </li>
  );
}

const SECTION_STORAGE_PREFIX = "fabs.sidebar.section.";

function NavSections({
  group,
  currentPath,
  parentOpen,
}: {
  group: Group;
  currentPath: string;
  parentOpen: boolean;
}) {
  const sections = useMemo(() => groupBySection(group.items), [group.items]);

  return (
    <>
      {sections.map((section) =>
        section.name === null ? (
          section.items.map((item) => (
            <SidebarNavItem
              key={item.title}
              item={item}
              group={group}
              active={!!item.ready && currentPath === item.url}
            />
          ))
        ) : (
          <SubSection
            key={section.name}
            groupLabel={group.label}
            name={section.name}
            items={section.items}
            group={group}
            currentPath={currentPath}
            parentOpen={parentOpen}
          />
        ),
      )}
    </>
  );
}

function SubSection({
  groupLabel,
  name,
  items,
  group,
  currentPath,
  parentOpen,
}: {
  groupLabel: string;
  name: string;
  items: Item[];
  group: Group;
  currentPath: string;
  parentOpen: boolean;
}) {
  const storageKey = `${SECTION_STORAGE_PREFIX}${groupLabel}::${name}`;
  const containsActive = items.some((i) => i.ready && currentPath === i.url);

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return containsActive;
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return containsActive;
  });

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium",
          "transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          containsActive ? "text-sidebar-foreground" : "text-sidebar-foreground/50",
        )}
      >
        {open ? (
          <ChevronDown aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{name}</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-sidebar-foreground/40">
          {items.length}
        </span>
      </button>

      <Collapse open={parentOpen && open}>
        <ul className="mt-0.5 space-y-0.5 pl-2">
          {items.map((item) => (
            <SidebarNavItem
              key={item.title}
              item={item}
              group={group}
              active={!!item.ready && currentPath === item.url}
            />
          ))}
        </ul>
      </Collapse>
    </li>
  );
}
