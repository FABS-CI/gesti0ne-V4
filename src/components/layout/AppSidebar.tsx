import { memo, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { SidebarBrandFooter, SidebarBrandHeader } from "./sidebar/SidebarBrandHeader";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { useVisibleGroups } from "./sidebar/use-visible-groups";

const STORAGE_KEY = "fabs.sidebar.open";

function AppSidebarImpl() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const visibleGroups = useVisibleGroups();

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

  return (
    <Sidebar collapsible="icon" className="app-sidebar-panel">
      <SidebarBrandHeader />
      <SidebarContent className="custom-scrollbar px-3 py-4">
        <nav aria-label="Navigation principale">
          <ul className="space-y-1">
            {visibleGroups.map((g) => (
              <SidebarNavGroup
                key={g.label}
                group={g}
                isOpen={openGroup === g.label}
                isActive={g.label === activeGroupLabel}
                currentPath={currentPath}
                onToggle={() => toggle(g.label)}
              />
            ))}
          </ul>
        </nav>
      </SidebarContent>
      <SidebarBrandFooter />
    </Sidebar>
  );
}

export const AppSidebar = memo(AppSidebarImpl);
