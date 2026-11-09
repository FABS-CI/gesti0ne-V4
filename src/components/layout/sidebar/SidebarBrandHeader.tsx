import { X } from "lucide-react";
import fabsLogo from "@/assets/fabs-logo.png";
import { SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";

export function SidebarBrandHeader() {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarHeader className="sidebar-brand-header relative flex h-16 shrink-0 justify-center border-b border-sidebar-border px-4">
      <div className="flex items-center gap-3 pr-10">
        <img
          src={fabsLogo}
          alt="Logo Éditions FABS-CI"
          width={36}
          height={36}
          decoding="async"
          className="sidebar-brand-logo h-9 w-9 shrink-0 rounded-lg object-contain p-1"
        />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
            Éditions FABS-CI
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">GESTI-one</p>
        </div>
      </div>

      {isMobile && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpenMobile(false)}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      {!isMobile && !compact && auto?.enabled && (
        <button
          type="button"
          aria-label={auto.pinned ? "Désépingler le menu" : "Épingler le menu"}
          aria-pressed={auto.pinned}
          title={auto.pinned ? "Désépingler le menu" : "Épingler le menu"}
          onClick={auto.togglePinned}
          className={cn(
            "absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors",
            "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            auto.pinned ? "text-sidebar-primary" : "text-sidebar-foreground/50",
          )}
        >
          <Pin
            className="h-4 w-4 transition-transform duration-200"
            strokeWidth={1.75}
            style={{ transform: auto.pinned ? "rotate(0deg)" : "rotate(45deg)" }}
          />
        </button>
      )}
    </SidebarHeader>
  );
}

/** Signature ÉDITIONS FABS-CI en pied de menu (masquée en rail). */
export function SidebarBrandFooter({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <SidebarFooter className="border-t border-sidebar-border bg-sidebar px-4 py-3">
      <p className="text-[11px] leading-4 text-sidebar-foreground/55">
        « Les livres sont des fenêtres par lesquelles on regarde le monde »
      </p>
      <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/40">
        © 2026 Éditions FABS-CI. Tous droits réservés.
      </p>
    </SidebarFooter>
  );
}
