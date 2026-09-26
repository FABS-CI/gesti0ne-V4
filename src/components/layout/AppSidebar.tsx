import { memo, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { SidebarBrandHeader } from "./sidebar/SidebarBrandHeader";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { useVisibleGroups } from "./sidebar/use-visible-groups";

const STORAGE_KEY = "fabs.sidebar.open";

function AppSidebarImpl() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const visibleGroups = useVisibleGroups();

  const activeGroupLabel =
    visibleGroups.find((g) => g.items.some((i) => i.ready && currentPath === i.url))?.label ?? null;
  const activeGroupCfg = visibleGroups.find((g) => g.label === activeGroupLabel) ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY) || "Tableau de bord";
  });

  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroup(activeGroupLabel);
      try {
        window.localStorage.setItem(STORAGE_KEY, activeGroupLabel);
      } catch {
        /* ignore */
      }
    }
  }, [activeGroupLabel]);

  const toggle = (label: string) => {
    setOpenGroup((prev) => {
      const next = prev === label ? null : label;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, next || "");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  return (
    <Sidebar collapsible="offcanvas" className="app-sidebar-panel">
      <SidebarBrandHeader accentGrad={activeGroupCfg?.grad ?? null} />
      <SidebarContent
        className="px-3 py-4"
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        <ul className="space-y-1.5">
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
      </SidebarContent>
    </Sidebar>
  );
}

export const AppSidebar = memo(AppSidebarImpl);
