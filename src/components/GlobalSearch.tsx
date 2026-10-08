import { formatDocumentReference, toStoredReferencePattern } from "@/lib/document-reference";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Package,
  FileText,
  Truck,
  UserCircle,
  Search,
  Loader2,
  Wallet,
  ShoppingCart,
  Undo2,
  UserPlus,
  ScrollText,
  Gauge,
  History,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermissions } from "@/hooks/use-permissions";
import { getRoutePermission } from "@/lib/route-permissions";
import { groups as NAV_GROUPS } from "@/components/layout/sidebar/nav-data";

type Hit = {
  id: string;
  group: string;
  label: string;
  sub?: string | null;
  to: string;
  params?: Record<string, string>;
};

type QuickAction = { id: string; label: string; to: string; icon: LucideIcon; keywords: string };

const QUICK_ACTIONS: QuickAction[] = [
  { id: "a-cmd", label: "Nouvelle commande", to: "/commandes/nouvelle", icon: ShoppingCart, keywords: "commande vente bc" },
  { id: "a-pai", label: "Nouveau paiement", to: "/paiements/nouveau", icon: Wallet, keywords: "paiement encaissement reglement" },
  { id: "a-ret", label: "Nouveau retour", to: "/retours/nouveau", icon: Undo2, keywords: "retour avoir" },
  { id: "a-cli", label: "Nouveau client", to: "/clients/nouveau", icon: UserPlus, keywords: "client creer" },
  { id: "a-rel", label: "Relevé de compte d'un client", to: "/etat-compte-clients", icon: ScrollText, keywords: "releve etat compte solde" },
  { id: "a-pil", label: "Centre de pilotage", to: "/pilotage", icon: Gauge, keywords: "pilotage tableau bord aujourd'hui" },
];

const RECENT_KEY = "fabs.globalSearch.recent";
const RECENT_MAX = 8;

function iconFor(group: string): LucideIcon {
  switch (group) {
    case "Clients":
      return Users;
    case "Utilisateurs":
      return UserCircle;
    case "Produits":
      return Package;
    case "Bons de livraison":
      return Truck;
    case "Paiements":
      return Wallet;
    case "Commandes":
      return ShoppingCart;
    default:
      return FileText;
  }
}

function readRecent(): Hit[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as Hit[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

async function search(q: string): Promise<Hit[]> {
  const raw = q.trim();
  // Saisie au format affiché |FC|26|51 → référence stockée FAC-2026-00051.
  const term = toStoredReferencePattern(raw) ?? raw;
  if (term.length < 2) return [];
  const { data, error } = await supabase.rpc("global_search", { _q: term });
  if (error) throw error;
  return Array.isArray(data) ? (data as unknown as Hit[]) : [];
}

function fold(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<Hit[]>([]);
  const debounced = useDebouncedValue(value, 300);
  const navigate = useNavigate();
  const { has, hasAny, isSuperAdmin } = usePermissions();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const allowedActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((a) => {
        if (isSuperAdmin) return true;
        const req = getRoutePermission(a.to);
        if (req === null) return true;
        if (req === undefined) return false;
        return Array.isArray(req) ? hasAny(req) : has(req);
      }),
    [has, hasAny, isSuperAdmin],
  );

  const allowedPages = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; title: string; group: string; icon: LucideIcon }[] = [];
    for (const g of NAV_GROUPS) {
      if (g.superAdminOnly && !isSuperAdmin) continue;
      for (const it of g.items) {
        if (it.ready === false || seen.has(it.url)) continue;
        if (!isSuperAdmin) {
          const req = getRoutePermission(it.url);
          if (req === undefined) continue;
          if (req !== null && !(Array.isArray(req) ? hasAny(req) : has(req))) continue;
        }
        seen.add(it.url);
        out.push({ url: it.url, title: it.title, group: g.label, icon: it.icon as LucideIcon });
      }
    }
    return out;
  }, [has, hasAny, isSuperAdmin]);

  const term = fold(value.trim());
  const visiblePages = term.length >= 2
    ? allowedPages.filter((p) => fold(`${p.title} ${p.group}`).includes(term)).slice(0, 8)
    : [];
  const visibleActions = term
    ? allowedActions.filter((a) => fold(`${a.label} ${a.keywords}`).includes(term))
    : allowedActions;

  const { data: hits = [], isFetching, isError } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => search(debounced),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of hits) {
      const arr = map.get(h.group) ?? [];
      arr.push(h);
      map.set(h.group, arr);
    }
    return Array.from(map.entries());
  }, [hits]);

  function close() {
    setOpen(false);
    setValue("");
  }

  function goHit(h: Hit) {
    const next = [h, ...readRecent().filter((r) => !(r.id === h.id && r.group === h.group))].slice(
      0,
      RECENT_MAX,
    );
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible : on ignore */
    }
    close();
    // Les cibles viennent de l'index serveur : chemins et paramètres dynamiques.
    navigate({ to: h.to, params: h.params } as Parameters<typeof navigate>[0]);
  }

  function goAction(a: QuickAction) {
    close();
    navigate({ to: a.to } as Parameters<typeof navigate>[0]);
  }

  const searching = debounced.trim().length >= 2;
  const showRecent = !term && recent.length > 0;

  function renderHit(h: Hit, keyPrefix: string) {
    const Icon = iconFor(h.group);
    return (
      <CommandItem
        key={`${keyPrefix}-${h.group}-${h.id}`}
        value={`${keyPrefix} ${h.group} ${h.label} ${formatDocumentReference(h.label)} ${h.sub ?? ""} ${h.id}`}
        onSelect={() => goHit(h)}
        className="gap-2"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{formatDocumentReference(h.label)}</div>
          {h.sub && (
            <div className="truncate text-xs text-muted-foreground">
              {h.sub.replace(/(\d+)(?:\.\d+)? FCFA/g, (_m, n: string) => `${n.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`)}
            </div>
          )}
        </div>
        {keyPrefix === "recent" && (
          <span className="text-xs text-muted-foreground">{h.group}</span>
        )}
      </CommandItem>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-input bg-muted/60 px-3 text-sm text-muted-foreground shadow-sm transition-all hover:bg-muted hover:ring-2 hover:ring-primary/20 sm:h-11 sm:gap-3 sm:px-4"
      >
        <Search className="h-4 w-4 text-primary shrink-0 sm:h-5 sm:w-5" />
        <span className="flex-1 text-left font-medium truncate">Rechercher ou agir…</span>
        <kbd className="hidden rounded border bg-background px-2 py-1 text-xs font-mono font-bold shadow-xs sm:inline-block">
          Ctrl + K
        </kbd>
      </button>

      <CommandDialog shouldFilter={false} open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <CommandInput
          value={value}
          onValueChange={setValue}
          placeholder="Client, CMD-2026…, FAC-2026…, PAI-…, produit, téléphone, ou une action…"
        />
        <CommandList>
          {visibleActions.length > 0 && (
            <CommandGroup heading="Actions rapides">
              {visibleActions.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`action ${a.label} ${a.keywords}`}
                  onSelect={() => goAction(a)}
                  className="gap-2"
                >
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {visiblePages.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Aller à une page">
                {visiblePages.map((p) => (
                  <CommandItem
                    key={`page-${p.url}`}
                    value={`page ${p.title} ${p.group} ${p.url}`}
                    onSelect={() => {
                      close();
                      navigate({ to: p.url } as Parameters<typeof navigate>[0]);
                    }}
                    className="gap-2"
                  >
                    <p.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{p.title}</span>
                    <span className="text-xs text-muted-foreground">{p.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {showRecent && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Ouverts récemment">
                {recent.map((h) => renderHit(h, "recent"))}
              </CommandGroup>
            </>
          )}

          {searching &&
            (isFetching && hits.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-sm text-destructive">
                La recherche a échoué. Réessayez.
              </div>
            ) : (
              grouped.map(([group, items]) => (
                <div key={group}>
                  <CommandSeparator />
                  <CommandGroup heading={group}>{items.map((h) => renderHit(h, "hit"))}</CommandGroup>
                </div>
              ))
            ))}

          <CommandEmpty>
            {term.length < 2 ? (
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4" /> Tapez au moins 2 caractères…
              </span>
            ) : isFetching ? (
              "Recherche…"
            ) : (
              "Aucun résultat"
            )}
          </CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  );
}
