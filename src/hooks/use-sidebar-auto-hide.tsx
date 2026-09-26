import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Sidebar rétractable au survol (desktop, pointeur fin uniquement).
 * - pinned : sidebar ouvert en permanence (persisté en localStorage), contenu décalé.
 * - hoverOpen : sidebar superposé au contenu, ouvert quand la souris approche du bord gauche.
 * Aucun calque n'est posé sur le contenu : la détection passe par mousemove sur document.
 */
const PIN_KEY = "fabs.sidebar.pinned";
const EDGE_PX = 18; // zone de détection
const TOLERANCE_PX = 12; // marge entre sidebar et contenu
const OPEN_DELAY = 90; // évite l'ouverture "flash" lors d'un passage rapide
const CLOSE_DELAY = 400;

type Ctx = {
  pinned: boolean;
  setPinned: (v: boolean) => void;
  togglePinned: () => void;
  hoverOpen: boolean;
  enabled: boolean;
};

const SidebarAutoHideContext = createContext<Ctx | null>(null);

export function useSidebarAutoHide() {
  return useContext(SidebarAutoHideContext);
}

export function SidebarAutoHideProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinnedState] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const openT = useRef<number | null>(null);
  const closeT = useRef<number | null>(null);
  const hoverRef = useRef(false);
  hoverRef.current = hoverOpen;

  useEffect(() => {
    try {
      setPinnedState(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const upd = () => setEnabled(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const setPinned = useCallback((v: boolean) => {
    setPinnedState(v);
    setHoverOpen(false);
    try {
      localStorage.setItem(PIN_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  const togglePinned = useCallback(() => setPinned(!pinnedRef.current), [setPinned]);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  useEffect(() => {
    if (!enabled || pinned) {
      setHoverOpen(false);
      return;
    }
    const clear = (r: { current: number | null }) => {
      if (r.current) window.clearTimeout(r.current);
      r.current = null;
    };
    const requestOpen = () => {
      clear(closeT);
      if (hoverRef.current || openT.current) return;
      openT.current = window.setTimeout(() => {
        openT.current = null;
        setHoverOpen(true);
      }, OPEN_DELAY);
    };
    const requestClose = () => {
      clear(openT);
      if (!hoverRef.current || closeT.current) return;
      closeT.current = window.setTimeout(() => {
        closeT.current = null;
        setHoverOpen(false);
      }, CLOSE_DELAY);
    };
    const panelWidth = () => {
      const el = document.querySelector<HTMLElement>(".app-sidebar-panel");
      return el ? el.getBoundingClientRect().width : 256;
    };
    const inFloating = (t: EventTarget | null) =>
      t instanceof Element &&
      !!t.closest(".app-sidebar-panel, [data-radix-popper-content-wrapper]");

    const onMove = (e: MouseEvent) => {
      const limit = hoverRef.current ? panelWidth() + TOLERANCE_PX : EDGE_PX;
      if (e.clientX <= limit || (hoverRef.current && inFloating(e.target))) requestOpen();
      else requestClose();
    };
    const onLeaveWindow = (e: MouseEvent) => {
      if (!e.relatedTarget) requestClose();
    };
    // Clavier : le focus dans le sidebar l'ouvre, le focus hors du sidebar le ferme.
    const onFocusIn = (e: FocusEvent) => {
      if (inFloating(e.target)) {
        clear(closeT);
        setHoverOpen(true);
      } else if (hoverRef.current) requestClose();
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onLeaveWindow);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onLeaveWindow);
      document.removeEventListener("focusin", onFocusIn);
      clear(openT);
      clear(closeT);
    };
  }, [enabled, pinned]);

  return (
    <SidebarAutoHideContext.Provider value={{ pinned, setPinned, togglePinned, hoverOpen, enabled }}>
      {children}
    </SidebarAutoHideContext.Provider>
  );
}
