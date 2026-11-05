import { Link, useRouterState } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";

const tabs = [
  { url: "/dashboard", label: "Accueil" },
  { url: "/commandes", label: "Ventes" },
  { url: "/factures", label: "Factures" },
  { url: "/stock", label: "Stock" },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#111827] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map(({ url, label }) => {
        const active = isActive(url);
        return (
          <Link
            key={url}
            to={url}
            className="relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors"
            style={{
              color: active ? "#60A5FA" : "#CBD5E1",
            }}
          >
            <span className="truncate leading-none">{label}</span>
            {active && (
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-primary"
              />
            )}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpenMobile(true)}
        className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <span className="leading-none">Menu</span>
      </button>
    </nav>
  );
}
