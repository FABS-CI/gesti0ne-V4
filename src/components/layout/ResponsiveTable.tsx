import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper mobile-first pour <Table> shadcn.
 * - Scroll horizontal propre avec header sticky.
 * - Ombres edge-fade dynamiques (visibles seulement si contenu masqué).
 * - `stickyFirstCol` fige la première colonne (matrices).
 * - `mobileCards` remplace la table par une vue carte sous md.
 */
export function ResponsiveTable({
  children,
  className,
  stickyFirstCol = false,
  hint = true,
  mobileCards,
}: {
  children: ReactNode;
  className?: string;
  stickyFirstCol?: boolean;
  hint?: boolean;
  mobileCards?: ReactNode;
}) {
  if (mobileCards !== undefined) {
    return (
      <div className={cn("relative", className)}>
        <div className="md:hidden">{mobileCards}</div>
        <div className="hidden md:block">
          <ScrollableTable stickyFirstCol={stickyFirstCol} hint={false}>
            {children}
          </ScrollableTable>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative -mx-3 sm:mx-0", className)}>
      <ScrollableTable stickyFirstCol={stickyFirstCol} hint={hint}>
        {children}
      </ScrollableTable>
    </div>
  );
}

function ScrollableTable({
  children,
  stickyFirstCol,
  hint,
}: {
  children: ReactNode;
  stickyFirstCol: boolean;
  hint: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn(
          "overflow-x-auto px-3 sm:px-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card",
          stickyFirstCol && "responsive-table--sticky",
        )}
      >
        {children}
      </div>
      {edges.left && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/90 to-transparent"
        />
      )}
      {edges.right && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background/90 to-transparent"
        />
      )}
      {hint && edges.right && (
        <div className="pointer-events-none absolute right-1 top-1 rounded bg-muted/80 px-1.5 py-0.5 text-xs text-muted-foreground sm:hidden">
          ← faites glisser →
        </div>
      )}
    </div>
  );
}

