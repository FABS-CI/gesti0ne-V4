import { memo, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useSidebarAutoHide } from "@/hooks/use-sidebar-auto-hide";
import { cn } from "@/lib/utils";
import { SidebarBrandFooter, SidebarBrandHeader } from "./sidebar/SidebarBrandHeader";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { useVisibleGroups } from "./sidebar/use-visible-groups";

const STORAGE_KEY = "fabs.sidebar.open";

/**
 * Le menu affiché en rail étroit (icônes de module seules) quand il est réduit
 * sur ordinateur et qu'il n'est pas déployé au survol.
 */
function useSidebarCompact() {
  const { isMobile, state } = useSidebar();
  const auto = useSidebarAutoHide();
  const hoverOpen = !!auto?.enabled && auto.hoverOpen;
  return !isMobile && state === "collapsed" && !hoverOpen;
}

function AppSidebarImpl() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const visibleGroups = useVisibleGroups();
  const { setOpen } = useSidebar();
  const compact = useSidebarCompact();

  const activeGroupLabel =
    visibleGroups.find((g) => g.items.some((i) => i.ready && currentPath === i.url))?.label ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY) || "Tableau de bord";
  });

  const remember = (label: string | null) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, label || "");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroup(activeGroupLabel);
      remember(activeGroupLabel);
    }
  }, [activeGroupLabel]);

  const toggle = (label: string) => {
    setOpenGroup((prev) => {
      const next = prev === label ? null : label;
      remember(next);
      return next;
    });
  };

  /** Depuis le rail : déploie le menu sur le module choisi. */
  const expandTo = (label: string) => {
    setOpenGroup(label);
    remember(label);
    setOpen(true);
  };

  return (
    <Sidebar collapsible="icon" className="app-sidebar-panel">
      <SidebarBrandHeader compact={compact} />
      <SidebarContent
        className={cn("custom-scrollbar py-3", compact ? "px-2" : "px-3")}
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        <nav aria-label="Navigation principale">
          <ul className={compact ? "space-y-1" : "space-y-0.5"}>
            {visibleGroups.map((g) => (
              <SidebarNavGroup
                key={g.label}
                group={g}
                compact={compact}
                isOpen={openGroup === g.label}
                isActive={g.label === activeGroupLabel}
                currentPath={currentPath}
                onToggle={() => toggle(g.label)}
                onExpand={() => expandTo(g.label)}
              />
            ))}
          </ul>
        </nav>
      </SidebarContent>
      <SidebarBrandFooter compact={compact} />
    </Sidebar>
  );
}

export const AppSidebar = memo(AppSidebarImpl);
