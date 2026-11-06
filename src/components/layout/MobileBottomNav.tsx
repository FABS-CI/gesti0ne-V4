import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Home, Menu, Package, ShoppingCart } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const tabs = [
  { url: "/dashboard", label: "Accueil", Icon: Home },
  { url: "/commandes", label: "Ventes", Icon: ShoppingCart },
  { url: "/factures", label: "Factures", Icon: FileText },
  { url: "/stock", label: "Stock", Icon: Package },
] as const;

const itemClass =
  "relative z-10 flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium " +
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glass-nav-glow)]";

/**
 * Barre de navigation mobile : verre dépoli flottant, indicateur cyan qui glisse
 * d'un onglet à l'autre. Les onglets, routes et le bouton « Menu » sont inchangés.
 */
export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");
  const activeIndex = tabs.findIndex((t) => isActive(t.url));

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="glass-nav fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="relative grid grid-cols-5 p-1">
        <span
          aria-hidden
          className="glass-nav-indicator"
          data-visible={activeIndex >= 0}
          style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
        />
        {tabs.map(({ url, label, Icon }, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={url}
              to={url}
              aria-current={active ? "page" : undefined}
              className={cn(itemClass, active ? "text-white" : "text-slate-300/80 active:text-white")}
            >
              <Icon aria-hidden strokeWidth={1.75} className="h-5 w-5" />
              <span className="truncate leading-none">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => setOpenMobile(true)}
          className={cn(itemClass, "text-slate-300/80 active:text-white")}
        >
          <Menu aria-hidden strokeWidth={1.75} className="h-5 w-5" />
          <span className="leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
