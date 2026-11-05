import { Link } from "@tanstack/react-router";
import { Check, Wallet, FileText, Hourglass, Percent, AlertTriangle, Package, Landmark, Users, ShoppingCart, Truck, TrendingUp, TrendingDown, Scale, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

interface Props {
  data: DashboardOverview | undefined;
  canSeeCA: boolean;
}

type To =
  "/clients" | "/commandes" | "/paiements" | "/factures" | "/stock" | "/tournees" | "/comptabilite";

function Money({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`} title={formatFCFA(value)}>
      <AnimatedNumber value={value} format={formatFCFACompact} />
      <span className="ml-1 text-xs font-normal text-muted-foreground">FCFA</span>
    </span>
  );
}

function Cell({
  to,
  label,
  children,
  sub,
  big = false,
  icon: Icon,
}: {
  icon?: LucideIcon;
  to: To;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  big?: boolean;
}) {
  return (
    <Link
      to={to}
      className="block min-w-0 px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className={`mt-1 font-semibold tabular-nums ${big ? "text-2xl" : "text-lg"}`}>
        {children}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Link>
  );
}

function Zone({ title, children, cols }: { title: string; children: ReactNode; cols: string }) {
  return (
    <section className="dash-lift min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
      <h2 className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className={`grid divide-y sm:divide-y-0 ${cols}`}>{children}</div>
    </section>
  );
}

function CountOrCheck({ n, tone }: { n: number; tone: "destructive" | "warning" }) {
  if (n === 0)
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
        <Check className="h-4 w-4" aria-hidden /> Aucun
      </span>
    );
  return (
    <AnimatedNumber
      value={n}
      className={tone === "destructive" ? "text-destructive" : "text-warning"}
    />
  );
}

export function DashboardKpis({ data, canSeeCA }: Props) {
  const facture = data?.montantFacture ?? 0;
  const reste = data?.resteAEncaisser ?? 0;
  const taux = Math.max(0, Math.min(100, data?.tauxEncaissement ?? 0));
  const clients = data?.clientsTotal ?? 0;
  const actifs = data?.clientsActifs ?? 0;
  const pctActifs = clients > 0 ? Math.round((actifs / clients) * 100) : 0;
  const retards = data?.nbRetards ?? 0;
  const solde = data?.solde ?? 0;

  return (
    <div className="dash-stagger space-y-4">
      {canSeeCA && (
        <Zone title="Performance" cols="sm:grid-cols-2 lg:grid-cols-4 sm:divide-x">
          <Cell to="/paiements" label="Chiffre d'affaires encaissé" icon={Wallet} big>
            <Money value={data?.caTotal ?? 0} />
          </Cell>
          <Cell to="/factures" label="Montant facturé" icon={FileText}>
            <Money value={facture} />
          </Cell>
          <Cell
            to="/factures"
            label="Reste à encaisser" icon={Hourglass}
            sub={
              facture > 0
                ? `${((reste / facture) * 100).toFixed(1).replace(".", ",")} % du facturé`
                : undefined
            }
          >
            <Money value={reste} />
          </Cell>
          <Cell
            to="/paiements"
            label="Taux d'encaissement" icon={Percent}
            sub={
              <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span className="dash-bar block h-full bg-primary" style={{ width: `${taux}%` }} />
              </span>
            }
          >
            <AnimatedNumber
              value={data?.tauxEncaissement ?? 0}
              decimals={1}
              format={(n) => `${n.toFixed(1).replace(".", ",")} %`}
            />
          </Cell>
        </Zone>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Zone
          title="À traiter"
          cols={canSeeCA ? "sm:grid-cols-3 sm:divide-x" : "sm:grid-cols-2 sm:divide-x"}
        >
          <Cell
            to="/factures"
            label="Factures en retard" icon={AlertTriangle}
            sub={
              canSeeCA && retards > 0 ? (
                <Money value={data?.montantRetard ?? 0} className="text-destructive" />
              ) : undefined
            }
          >
            <CountOrCheck n={retards} tone="destructive" />
          </Cell>
          <Cell to="/stock" label="Stock bas" icon={Package}>
            <CountOrCheck n={data?.nbStockBas ?? 0} tone="warning" />
          </Cell>
          {canSeeCA && (
            <Cell to="/clients" label="Encours clients" icon={Landmark}>
              <Money value={data?.soldeTotal ?? 0} />
            </Cell>
          )}
        </Zone>

        <Zone title="Activité" cols="sm:grid-cols-3 sm:divide-x">
          <Cell to="/clients" label="Clients" icon={Users} sub={`${actifs} actifs · ${pctActifs} %`}>
            <AnimatedNumber value={clients} />
          </Cell>
          <Cell to="/commandes" label="Commandes" icon={ShoppingCart}>
            <AnimatedNumber value={data?.nbCommandes ?? 0} />
          </Cell>
          <Cell to="/tournees" label="Frais de tournée" icon={Truck}>
            <Money value={data?.fraisTournees ?? 0} />
          </Cell>
        </Zone>
      </div>

      {canSeeCA && (
        <Zone title="Trésorerie" cols="sm:grid-cols-3 sm:divide-x">
          <Cell to="/comptabilite" label="Recettes" icon={TrendingUp}>
            <Money value={data?.recettes ?? 0} />
          </Cell>
          <Cell to="/comptabilite" label="Dépenses" icon={TrendingDown}>
            <Money value={data?.depenses ?? 0} />
          </Cell>
          <Cell to="/comptabilite" label="Solde" icon={Scale}>
            <Money
              value={solde}
              className={solde > 0 ? "text-success" : solde < 0 ? "text-destructive" : ""}
            />
          </Cell>
        </Zone>
      )}
    </div>
  );
}
