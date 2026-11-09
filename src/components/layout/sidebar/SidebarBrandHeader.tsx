import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import fabsLogo from "@/assets/fabs-logo.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { useExercice } from "@/contexts/ExerciceContext";
import { useAuth } from "@/hooks/use-auth";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SidebarBrandHeader({ compact = false }: { compact?: boolean }) {
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const { exerciceConsulte } = useExercice();

  return (
    <SidebarHeader
      className={cn(
        "sidebar-brand-header relative flex h-[4.5rem] shrink-0 justify-center border-b border-sidebar-border",
        compact ? "items-center px-2" : "px-4",
      )}
    >
      <div className={cn("flex items-center gap-3", compact ? "justify-center" : "w-full pr-8")}>
        <img
          src={fabsLogo}
          alt="Logo Éditions FABS-CI"
          width={compact ? 40 : 36}
          height={compact ? 40 : 36}
          decoding="async"
          className={cn(
            "sidebar-brand-logo shrink-0 rounded-xl object-contain p-1",
            compact ? "h-10 w-10" : "h-9 w-9",
          )}
        />
        {!compact && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              EDITIONS FABS-CI
            </p>
            <p className="mt-1 truncate text-xs text-sidebar-foreground/60">
              {exerciceConsulte ? `Exercice ${exerciceConsulte.code}` : "Exercice en cours"}
            </p>
          </div>
        )}
      </div>

      {isMobile ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpenMobile(false)}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          aria-label={compact ? "Développer le menu" : "Réduire le menu"}
          title={compact ? "Développer le menu" : "Réduire le menu"}
          onClick={toggleSidebar}
          className="sidebar-collapse-button absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-card text-card-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {compact ? (
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      )}
    </SidebarHeader>
  );
}

export function SidebarGlobalSearchButton({ compact = false }: { compact?: boolean }) {
  const openExistingSearch = () => {
    document.querySelector<HTMLButtonElement>("[data-global-search-trigger]")?.click();
  };

  return (
    <div className={cn("shrink-0 py-3", compact ? "px-2" : "px-3")}>
      <button
        type="button"
        aria-label="Rechercher dans l’ERP"
        title="Rechercher dans l’ERP (Ctrl+K)"
        onClick={openExistingSearch}
        className={cn(
          "sidebar-search-button flex items-center border border-sidebar-border text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          compact
            ? "mx-auto h-10 w-10 justify-center rounded-xl"
            : "h-10 w-full gap-2 rounded-xl px-3 text-sm",
        )}
      >
        <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        {!compact && (
          <>
            <span className="flex-1 text-left">Rechercher</span>
            <kbd className="rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl K
            </kbd>
          </>
        )}
      </button>
    </div>
  );
}

export function SidebarBrandFooter({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const label = user?.user_metadata?.nom_complet || user?.email || "Utilisateur";
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, nom_complet")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { avatar_url: string | null; nom_complet: string | null } | null;
    },
  });
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_url);
  const displayName = profile?.nom_complet || label;

  const openExistingAccountMenu = () => {
    window.dispatchEvent(new Event("fabs:open-account-menu"));
  };

  return (
    <SidebarFooter className={cn("sidebar-brand-footer border-t border-sidebar-border", compact ? "p-2" : "p-3")}>
      <div className="hidden lg:block">
        <button
          type="button"
          aria-label="Ouvrir le menu du compte"
          onClick={openExistingAccountMenu}
          className={cn(
            "flex w-full items-center rounded-xl text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            compact ? "justify-center p-0" : "gap-3 p-2",
          )}
        >
          <span className="relative shrink-0">
            <Avatar className={compact ? "h-10 w-10" : "h-9 w-9"}>
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span
              aria-label="En ligne"
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success"
            />
          </span>
          {!compact && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">
                {displayName}
              </span>
              <span className="mt-1 block truncate text-xs text-sidebar-foreground/55">
                {user?.email}
              </span>
            </span>
          )}
        </button>
      </div>
      <div className="lg:hidden">
        <p className="text-[11px] leading-4 text-sidebar-foreground/55">
          « Les livres sont des fenêtres par lesquelles on regarde le monde »
        </p>
        <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/40">
          © 2026 Éditions FABS-CI. Tous droits réservés.
        </p>
      </div>
    </SidebarFooter>
  );
}
