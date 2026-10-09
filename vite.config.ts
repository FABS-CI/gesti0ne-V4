// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    router: {
      codeSplittingOptions: {
        // La route d'authentification est le point d'entrée de toute session.
        // La garder dans le bundle principal évite qu'un cold start SSR rende
        // un Suspense pendant que le client possède déjà son chunk, situation
        // qui provoquait un mismatch d'hydratation et l'écran cerr_* du preview.
        splitBehavior: ({ routeId }: { routeId: string }) =>
          routeId === "/auth" ? [] : undefined,
      },
    },
  },
  vite: {
    plugins: [mcpPlugin()],
    // Pré-optimise les modules du routeur découverts tardivement : sinon Vite
    // les ré-optimise en cours de session, deux copies du routeur coexistent
    // et l'aperçu tombe sur « Expected to find a match below the root match ».
    optimizeDeps: {
      include: [
        "@tanstack/router-core",
        "@tanstack/router-core/isServer",
        "@tanstack/router-core/ssr/client",
        "seroval",
      ],
    },
  },
});
