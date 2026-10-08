import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ClientOnly,
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { installClientErrorTracing } from "../lib/client-error-tracing";
import { getStoredTheme } from "../hooks/use-theme";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { RouteError, RouteNotFound } from "../components/route-boundaries";


const PWAInstallPrompt = lazy(() =>
  import("@/components/pwa-install-prompt").then((m) => ({ default: m.PWAInstallPrompt })),
);
const AppActionTracker = lazy(() =>
  import("@/components/AppActionTracker").then((m) => ({ default: m.AppActionTracker })),
);
const PdfPreviewHost = lazy(() =>
  import("@/components/pdf/PdfPreviewHost").then((m) => ({ default: m.PdfPreviewHost })),
);
const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));


// Overlay de diagnostic perf, monté au niveau root pour être disponible
// sur toutes les routes (auth incluse). Chunk chargé uniquement si activé.
const PerfOverlay = lazy(() =>
  import("@/components/debug/PerfOverlay").then((m) => ({ default: m.PerfOverlay })),
);

function usePerfOverlayEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const check = () =>
      localStorage.getItem("perfOverlay") === "1" ||
      new URLSearchParams(window.location.search).get("debug") === "perf";
    setEnabled(check());
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setEnabled((v) => {
          const next = !v;
          try {
            localStorage.setItem("perfOverlay", next ? "1" : "0");
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return enabled;
}

/**
 * Clés de requêtes persistées en localStorage — référentiels partagés lus par
 * de multiples écrans. Faute de Redis serveur disponible sur cette plateforme,
 * cette persistance client tient lieu de cache warm : les données restent
 * disponibles instantanément entre sessions/onglets, même hors ligne, et
 * évitent des refetch coûteux à froid quand le trafic augmente.
 */
const PERSISTED_QUERY_KEYS = new Set([
  "clients-mini",
  "produits-mini",
  "depots",
  "categories-produits",
  "fournisseurs-mini",
  "employes-mini",
  "exercices",
  "parametres",
  "rbac-roles",
  "rbac-permissions",
  "modeles-documents",
]);

// NotFound + Error boundary components partagés — voir components/route-boundaries.tsx


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "GESTI-ONE ERP — Editions FABS-CI" },
      {
        name: "description",
        content:
          "GESTI-ONE ERP : Gestion intégrée des Editions FABS-CI",
      },
      { name: "author", content: "EDITIONS FABS-CI" },
      { property: "og:title", content: "GESTI-ONE ERP — Editions FABS-CI" },
      {
        property: "og:description",
        content:
          "GESTI-ONE ERP : Gestion intégrée des Editions FABS-CI",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#ea580c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "GESTI-ONE" },
      { name: "twitter:title", content: "GESTI-ONE ERP — Editions FABS-CI" },

      {
        name: "description",
        content:
          "EDITIONS FABS-CI",
      },
      {
        property: "og:description",
        content:
          "EDITIONS FABS-CI",
      },
      {
        name: "twitter:description",
        content:
          "EDITIONS FABS-CI",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e94d7835-8522-41f4-baa6-159e8abf8e52/id-preview-c8f97523--5799396b-bcb4-415d-acfc-8d2121c67bf8.lovable.app-1783322815611.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e94d7835-8522-41f4-baa6-159e8abf8e52/id-preview-c8f97523--5799396b-bcb4-415d-acfc-8d2121c67bf8.lovable.app-1783322815611.png",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=3" },
      { rel: "icon", type: "image/x-icon", sizes: "32x32", href: "/favicon.ico?v=3" },
      { rel: "icon", type: "image/x-icon", sizes: "16x16", href: "/favicon.ico?v=3" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=3" },
      { rel: "manifest", href: "/manifest.webmanifest?v=3" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: RouteNotFound,
  errorComponent: RouteError,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const perfOverlayEnabled = usePerfOverlayEnabled();

  useEffect(() => {
    installClientErrorTracing();
    // Applique le thème enregistré dès le démarrage (page de connexion incluse) :
    // sans cela, le thème sombre n'était posé que par ThemeToggle, une fois connecté.
    const storedTheme = getStoredTheme();
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
    document.documentElement.setAttribute("data-theme", storedTheme);
    // Lot 5 — Web Vitals (best-effort, ne bloque jamais le rendu)
    import("../lib/web-vitals-reporter").then((m) => m.installWebVitals()).catch(() => {});

    // PWA Service Worker Registration (avec auto-mise à jour)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        registration.update().catch(() => {});
        registration.addEventListener('updatefound', () => {
          const sw = registration.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            // Nouveau SW actif alors qu'une ancienne version contrôlait la page
            if (sw.state === 'activated' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      }).catch(registrationError => {
        console.debug('SW registration failed: ', registrationError);
      });
    }

  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "fabs-query-cache",
      throttleTime: 1000,
    });
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000, // 24 h
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const first = query.queryKey?.[0];
          // Ne jamais persister une requête en cours (status='pending') :
          // sa `promise` non résolue casse persistQueryClientRestore avec
          // "promise.then is not a function" au prochain démarrage.
          if (query.state.status !== "success") return false;
          return typeof first === "string" && PERSISTED_QUERY_KEYS.has(first);
        },
      },
      buster: "v2",

    });
    return () => unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <PWAInstallPrompt />
          <AppActionTracker />
          <PdfPreviewHost />
          <Toaster />

        </Suspense>
      </ClientOnly>
      {perfOverlayEnabled && (
        <Suspense fallback={null}>
          <PerfOverlay />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
