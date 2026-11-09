import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
  compact = false,
  onExpand,
}: {
  group: Group;
  isOpen: boolean;
  isActive: boolean;
  currentPath: string;
  onToggle: () => void;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const Icon = group.groupIcon;

  if (compact) {
    return (
      <li className="relative">
        <HoverCard openDelay={120} closeDelay={180}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={onExpand}
              aria-label={`${group.label} — développer le module`}
              className={cn(
                "relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-200 hover:scale-[1.08]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                  : "border-sidebar-border/70 bg-sidebar-accent/45 text-sidebar-foreground/65 hover:bg-sidebar-accent",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -left-3 h-1.5 w-1.5 rounded-full bg-sidebar-primary"
                />
              )}
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={12}
            className="sidebar-glass-popover max-h-[70vh] w-72 overflow-y-auto p-2"
          >
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/55">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              <RailSections group={group} currentPath={currentPath} />
            </ul>
          </HoverCardContent>
        </HoverCard>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          isActive
            ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              isActive
                ? "border-sidebar-primary/40 bg-sidebar-accent text-sidebar-primary"
                : "border-sidebar-border/70 bg-sidebar-accent/35 text-sidebar-foreground/60",
            )}
          >
            <Icon aria-hidden strokeWidth={1.75} className="h-4 w-4" />
          </span>
          <span className="whitespace-normal leading-4">{group.label}</span>
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
        <ul className="mb-2 ml-[1.45rem] mt-1 space-y-0.5 border-l border-sidebar-border/80 pl-2.5">
          <NavSections group={group} currentPath={currentPath} parentOpen={isOpen} />
        </ul>
      </Collapse>
    </li>
  );
}

function RailSections({ group, currentPath }: { group: Group; currentPath: string }) {
  const sections = useMemo(() => groupBySection(group.items), [group.items]);
  return (
    <>
      {sections.map((section) => (
        <li key={section.name ?? "__flat__"}>
          {section.name && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-sidebar-foreground/50">
              {section.name}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.title}
                item={item}
                group={group}
                active={!!item.ready && currentPath === item.url}
              />
            ))}
          </ul>
        </li>
      ))}
    </>
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
          "flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium",
          "transition-colors hover:bg-sidebar-accent/35 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          containsActive ? "text-sidebar-foreground" : "text-sidebar-foreground/55",
        )}
      >
        {open ? (
          <ChevronDown aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{name}</span>
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
