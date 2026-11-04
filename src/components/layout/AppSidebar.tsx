import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useSidebarAutoHide } from "@/hooks/use-sidebar-auto-hide";
import { SidebarBrandHeader } from "./sidebar/SidebarBrandHeader";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { SidebarRailGroup } from "./sidebar/SidebarRailGroup";
import { useVisibleGroups } from "./sidebar/use-visible-groups";

const STORAGE_KEY = "fabs.sidebar.open";

function AppSidebarImpl() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const visibleGroups = useVisibleGroups();
  const { isMobile, state, setOpen } = useSidebar();
  const auto = useSidebarAutoHide();
  // Réduit sur ordinateur : rail d'icônes, sauf pendant l'ouverture au survol.
  const rail = !isMobile && state === "collapsed" && !auto?.hoverOpen;

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

  // Clic sur une icône du rail : ouvre le module. Avec l'ouverture au survol,
  // le panneau est déjà déployé ; sinon on développe la barre latérale.
  const openFromRail = (label: string) => {
    setOpenGroup(label);
    if (!auto?.enabled) setOpen(true);
  };

  return (
    <Sidebar collapsible="icon" className="app-sidebar-panel">
      <SidebarBrandHeader accentGrad={activeGroupCfg?.grad ?? null} compact={rail} />
      <SidebarContent
        className={cn(
          "group-data-[collapsible=icon]:overflow-auto",
          rail ? "items-center px-2 py-4" : "px-3 py-4",
        )}
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        <ul className="space-y-1.5">
          {visibleGroups.map((g) =>
            rail ? (
              <SidebarRailGroup
                key={g.label}
                group={g}
                isActive={g.label === activeGroupLabel}
                onOpen={() => openFromRail(g.label)}
              />
            ) : (
              <SidebarNavGroup
                key={g.label}
                group={g}
                isOpen={openGroup === g.label}
                isActive={g.label === activeGroupLabel}
                currentPath={currentPath}
                onToggle={() => toggle(g.label)}
              />
            ),
          )}
        </ul>
      </SidebarContent>
    </Sidebar>
  );
}

export const AppSidebar = memo(AppSidebarImpl);
