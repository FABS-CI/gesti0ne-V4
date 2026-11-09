import { memo, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  SidebarBrandFooter,
  SidebarBrandHeader,
  SidebarGlobalSearchButton,
} from "./sidebar/SidebarBrandHeader";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { useVisibleGroups } from "./sidebar/use-visible-groups";

const STORAGE_KEY = "fabs.sidebar.open";

function AppSidebarImpl() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const visibleGroups = useVisibleGroups();
  const { isMobile, state, setOpen } = useSidebar();
  const compact = !isMobile && state === "collapsed";

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

  const expandTo = (label: string) => {
    setOpenGroup(label);
    remember(label);
    setOpen(true);
  };

  return (
    <Sidebar collapsible="icon" className="app-sidebar-panel">
      <SidebarBrandHeader compact={compact} />
      <SidebarGlobalSearchButton compact={compact} />
      <SidebarContent className={cn("custom-scrollbar py-3", compact ? "px-2" : "px-3")}>
        <nav aria-label="Navigation principale">
          <ul className={compact ? "space-y-2" : "space-y-1"}>
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
