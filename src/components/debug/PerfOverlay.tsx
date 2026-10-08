/**
 * Overlay de diagnostic performance.
 *
 * Affiche en temps réel, sans altérer le rendu de l'application :
 *  - la route courante et la durée écoulée depuis le dernier changement d'URL
 *  - le temps de "mount" (premier paint après navigation) via PerformanceObserver
 *  - le nombre + la durée des requêtes réseau (fetch/XHR) déclenchées depuis
 *    la navigation, avec le top 5 par durée cumulée
 *  - l'état du cache TanStack Query (nb de queries fetching / stale / total)
 *
 * ACTIVATION (aucune trace en prod si non activé) :
 *  - `localStorage.setItem('perfOverlay', '1')` puis rechargement
 *  - ou `?debug=perf` dans l'URL
 *  - toggle rapide : Ctrl+Shift+P
 *
 * Aucune modification du design de l'application : overlay flottant en bas
 * à droite, monté via portail dans <body>, ignoré tant qu'inactif.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

type NetSample = { url: string; ms: number; ts: number; status?: number };

function useToggle(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromStorage = localStorage.getItem("perfOverlay") === "1";
    const fromUrl = new URLSearchParams(window.location.search).get("debug") === "perf";
    setEnabled(fromStorage || fromUrl);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setEnabled((v) => {
          const next = !v;
          localStorage.setItem("perfOverlay", next ? "1" : "0");
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
 * Intercepte window.fetch (et XHR pour Supabase realtime) pour mesurer la
 * durée de chaque requête. Ne modifie rien : appelle l'original et enregistre.
 * Idempotent : une seule installation même si l'overlay est monté/démonté.
 */
function installNetInterceptor(): { samples: NetSample[]; reset: () => void } {
  const w = window as unknown as {
    __perfOverlay?: { samples: NetSample[]; reset: () => void };
  };
  if (w.__perfOverlay) return w.__perfOverlay;

  const samples: NetSample[] = [];
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const t0 = performance.now();
    const req = args[0];
    const url =
      typeof req === "string" ? req : req instanceof URL ? req.href : (req as Request).url;
    try {
      const res = await origFetch(...args);
      samples.push({ url, ms: performance.now() - t0, ts: Date.now(), status: res.status });
      if (samples.length > 500) samples.splice(0, samples.length - 500);
      return res;
    } catch (e) {
      samples.push({ url, ms: performance.now() - t0, ts: Date.now(), status: 0 });
      throw e;
    }
  };

  const api = {
    samples,
    reset: () => samples.splice(0, samples.length),
  };
  w.__perfOverlay = api;
  return api;
}

function short(url: string) {
  try {
    const u = new URL(url, window.location.origin);
    // Pour Supabase / PostgREST : garder le chemin + table
    return u.pathname.replace(/^\/rest\/v1\//, "pg:").slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

export function PerfOverlay() {
  const enabled = useToggle();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const [, force] = useState(0);
  const [navStart, setNavStart] = useState(() => performance.now());
  const [firstPaintMs, setFirstPaintMs] = useState<number | null>(null);
  const net = useMemo(() => (enabled ? installNetInterceptor() : null), [enabled]);

  // Reset au changement de route + capture du premier paint post-nav
  useEffect(() => {
    if (!enabled) return;
    const t0 = performance.now();
    setNavStart(t0);
    setFirstPaintMs(null);
    net?.reset();

    let raf = requestAnimationFrame(() => {
      // 2 rAF ≈ après commit + paint
      raf = requestAnimationFrame(() => setFirstPaintMs(performance.now() - t0));
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, enabled, net]);

  // Refresh périodique pour actualiser les compteurs
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled || typeof document === "undefined") return null;

  const now = performance.now();
  const elapsed = now - navStart;
  const samples = net?.samples ?? [];
  const totalMs = samples.reduce((s, x) => s + x.ms, 0);
  const top = [...samples].sort((a, b) => b.ms - a.ms).slice(0, 5);

  const queries = queryClient.getQueryCache().getAll();
  const fetching = queries.filter((q) => q.state.fetchStatus === "fetching").length;
  const stale = queries.filter((q) => q.isStale()).length;

  const overlay = (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 2147483647,
        width: 360,
        maxHeight: "50vh",
        overflow: "auto",
        background: "rgba(15, 23, 42, 0.94)",
        color: "#e2e8f0",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: 8,
        padding: 10,
        font: "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ color: "#38bdf8" }}> perf overlay</strong>
        <span style={{ opacity: 0.6 }}>Ctrl+Shift+P</span>
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ opacity: 0.6 }}>route </span>
        <span style={{ color: "#facc15" }}>{pathname}</span>
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ opacity: 0.6 }}>écoulé </span>
        <b>{elapsed.toFixed(0)} ms</b>
        <span style={{ opacity: 0.6 }}> · 1er paint </span>
        <b style={{ color: firstPaintMs && firstPaintMs > 500 ? "#f87171" : "#86efac" }}>
          {firstPaintMs == null ? "…" : `${firstPaintMs.toFixed(0)} ms`}
        </b>
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ opacity: 0.6 }}>net </span>
        <b>{samples.length}</b>
        <span style={{ opacity: 0.6 }}> req · </span>
        <b>{totalMs.toFixed(0)} ms</b> cumul
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ opacity: 0.6 }}>query cache </span>
        <b>{queries.length}</b>
        <span style={{ opacity: 0.6 }}> · </span>
        <b style={{ color: fetching ? "#fbbf24" : "#94a3b8" }}>{fetching}</b>
        <span style={{ opacity: 0.6 }}> fetching · </span>
        <b>{stale}</b>
        <span style={{ opacity: 0.6 }}> stale</span>
      </div>
      {top.length > 0 && (
        <div>
          <div style={{ opacity: 0.6, marginBottom: 2 }}>top 5 requêtes (ms)</div>
          {top.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: s.status && s.status >= 400 ? "#f87171" : "#cbd5e1",
                }}
                title={s.url}
              >
                {short(s.url)}
              </span>
              <b style={{ color: s.ms > 500 ? "#f87171" : s.ms > 200 ? "#fbbf24" : "#86efac" }}>
                {s.ms.toFixed(0)}
              </b>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, opacity: 0.55 }}>
        Astuce : ouvre l'app avec ?debug=perf ou active-le via localStorage.perfOverlay=1
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
