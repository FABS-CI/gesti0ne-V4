import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Topbar } from "./Topbar";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleWarningModal } from "@/components/IdleWarningModal";
import { loadDocumentSettings } from "@/lib/document-settings-api";
import { useAuth } from "@/hooks/use-auth";
import { useRouteRestrictions } from "@/hooks/use-route-restrictions";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { usePresenceBroadcast } from "@/hooks/use-presence-broadcast";
import { useRealtimeBus } from "@/hooks/use-realtime-bus";
import { useIdlePrefetch, type PrefetchTarget } from "@/hooks/use-idle-prefetch";
import { ShieldAlert } from "lucide-react";
import { ExerciceProvider } from "@/contexts/ExerciceContext";
import { ExerciceReadOnlyBanner } from "./ExerciceReadOnlyBanner";
import { buildModuleThemeVars, getModuleColor } from "@/lib/module-theme";
import { SystemAlertsBanner } from "@/components/SystemAlertsBanner";
import { useAndroidBackButton } from "@/hooks/use-android-back-button";
import { useMobileKeyboard } from "@/hooks/use-mobile-keyboard";
import { SidebarAutoHideProvider, useSidebarAutoHide } from "@/hooks/use-sidebar-auto-hide";

// Overlay de diagnostic perf : ~200 lignes + interception fetch/XHR.
// Ne charge le chunk que si le toggle est activé, sinon 0 coût runtime.
const PerfOverlay = lazy(() =>
  import("@/components/debug/PerfOverlay").then((m) => ({ default: m.PerfOverlay })),
);

function usePerfOverlayEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const enabledFromUrl = new URLSearchParams(window.location.search).get("debug") === "perf";
      try {
        return localStorage.getItem("perfOverlay") === "1" || enabledFromUrl;
      } catch {
        return enabledFromUrl;
      }
    };
    setEnabled(check());
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) setEnabled(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return enabled;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { showWarning, countdown, extendSession, handleLogout } = useIdleTimeout();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isRestricted } = useRouteRestrictions();
  const blocked = isRestricted(pathname);
  const moduleThemeVars = buildModuleThemeVars(getModuleColor(pathname));
  const perfOverlayEnabled = usePerfOverlayEnabled();

  // Écoute globale des notifications temps réel (son + toast + notif navigateur)
  useNotificationsRealtime();

  // Bus temps réel : synchro auto listes ventes/stock/livraison/paiements (Lot 1 perf).
  useRealtimeBus();

  // Publie la présence temps réel de l'utilisateur courant (canal app-presence)
  usePresenceBroadcast({ id: user?.id ?? "", email: user?.email });

  // Hydrate document_settings (modèle actif + logo personnalisé) au boot
  useEffect(() => {
    loadDocumentSettings().catch(() => {
      /* silencieux : fallback local */
    });
  }, []);

  // Préchargement intelligent (Lot 7 perf) : à l'idle, on chauffe les
  // routes les plus visitées après login pour supprimer la latence
  // perçue au 1er clic sur la sidebar.
  const queryClient = useQueryClient();
  const prefetchTargets = useMemo<PrefetchTarget[]>(
    () => [
      { route: "/tableau-de-bord" },
      { route: "/commandes" },
      { route: "/factures" },
      { route: "/clients" },
      { route: "/stock" },
    ],
    [],
  );
  useIdlePrefetch(prefetchTargets, queryClient, !!user && !blocked);

  return (
    <ExerciceProvider>
      <SidebarAutoHideProvider>
      <AutoHideSidebarProvider>
        <MobileSwipeGestures />
        <AndroidBackButtonHandler />
        <div className="flex min-h-dvh w-full">
          <AutoHideSidebarSlot>
            <AppSidebar />
          </AutoHideSidebarSlot>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="app-shell-header sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/60 backdrop-blur-xl px-3 pt-[var(--safe-area-top)] sm:px-4">
              <SidebarTrigger className="hover:bg-accent h-9 w-9 shrink-0 rounded-full" />
              <Topbar />
            </header>
            <div className="app-shell-banner">
              <ExerciceReadOnlyBanner />
              <SystemAlertsBanner />
            </div>
            <main
              className="app-shell-main min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(6rem+var(--keyboard-height,0px)+var(--safe-area-bottom))] sm:p-5 md:pb-[calc(1rem+var(--keyboard-height,0px)+var(--safe-area-bottom))] lg:p-8"
              style={moduleThemeVars}
            >
              {blocked ? (
                <AccessDenied />
              ) : (
                <div key={pathname} className="animate-fade-in min-h-[500px] w-full bg-background">
                  {children}
                </div>
              )}
            </main>
            <MobileBottomNav />
          </div>
        </div>
        {showWarning && (
          <IdleWarningModal
            countdown={countdown}
            onExtend={extendSession}
            onLogout={handleLogout}
          />
        )}
        {perfOverlayEnabled && (
          <Suspense fallback={null}>
            <PerfOverlay />
          </Suspense>
        )}
      </AutoHideSidebarProvider>
      </SidebarAutoHideProvider>
    </ExerciceProvider>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-20 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <h1 className="text-xl font-semibold">403 — Accès interdit</h1>
      <p className="text-sm text-muted-foreground">
        Vous n'avez pas l'autorisation d'accéder à cette section.
      </p>
      <Link to="/" className="text-sm text-primary underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}

/**
 * Swipe depuis le bord gauche (< 24 px) pour ouvrir le sidebar mobile,
 * et swipe vers la gauche sur le contenu ouvert pour le fermer.
 */
function MobileSwipeGestures() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (!isMobile) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = !openMobile && startX < 24;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 60 && dy < 50) setOpenMobile(true);
      tracking = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isMobile, openMobile, setOpenMobile]);
  return null;
}

/** Bouton retour Android + clavier virtuel (Capacitor). No-op sur le web. */
function AndroidBackButtonHandler() {
  useAndroidBackButton();
  useMobileKeyboard();
  return null;
}

/** Desktop souris : le sidebar suit l'état « épinglé » ; sinon comportement d'origine. */
function AutoHideSidebarProvider({ children }: { children: ReactNode }) {
  const auto = useSidebarAutoHide();
  if (auto?.enabled) {
    return (
      <SidebarProvider open={auto.pinned} onOpenChange={auto.setPinned}>
        {children}
      </SidebarProvider>
    );
  }
  return <SidebarProvider>{children}</SidebarProvider>;
}

function AutoHideSidebarSlot({ children }: { children: ReactNode }) {
  const auto = useSidebarAutoHide();
  const hoverOpen = !!auto?.enabled && !auto.pinned && auto.hoverOpen;
  const expanded = !auto?.enabled || auto.pinned || auto.hoverOpen;
  return (
    <div
      className="app-shell-sidebar"
      data-hover-open={hoverOpen ? "true" : "false"}
      aria-expanded={expanded}
    >
      {children}
    </div>
  );
}
