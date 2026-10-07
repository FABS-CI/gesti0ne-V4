import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

interface Props {
  data: DashboardOverview | undefined;
  canSeeCA: boolean;
}

type To = "/clients" | "/commandes" | "/paiements" | "/factures" | "/stock" | "/tournees" | "/comptabilite";

function Money({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`} title={formatFCFA(value)}>
      {formatFCFACompact(value)}
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
}: {
  to: To;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  big?: boolean;
}) {
  return (
    <Link
      to={to}
      className="block min-w-0 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <div className={`mt-1 font-semibold tabular-nums ${big ? "text-2xl" : "text-lg"}`}>
        {children}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Link>
  );
}

function Zone({ title, children, cols }: { title: string; children: ReactNode; cols: string }) {
  return (
    <section className="min-w-0 rounded-md border bg-card">
      <h2 className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
  return <span className={tone === "destructive" ? "text-destructive" : "text-warning"}>{n}</span>;
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
    <div className="space-y-4">
      {canSeeCA && (
        <Zone title="Performance" cols="sm:grid-cols-2 lg:grid-cols-4 sm:divide-x">
          <Cell to="/paiements" label="Chiffre d'affaires encaissé" big>
            <Money value={data?.caTotal ?? 0} />
          </Cell>
          <Cell to="/factures" label="Montant facturé">
            <Money value={facture} />
          </Cell>
          <Cell
            to="/factures"
            label="Reste à encaisser"
            sub={facture > 0 ? `${((reste / facture) * 100).toFixed(1).replace(".", ",")} % du facturé` : undefined}
          >
            <Money value={reste} />
          </Cell>
          <Cell
            to="/paiements"
            label="Taux d'encaissement"
            sub={
              <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-primary" style={{ width: `${taux}%` }} />
              </span>
            }
          >
            {(data?.tauxEncaissement ?? 0).toFixed(1).replace(".", ",")} %
          </Cell>
        </Zone>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Zone title="À traiter" cols={canSeeCA ? "sm:grid-cols-3 sm:divide-x" : "sm:grid-cols-2 sm:divide-x"}>
          <Cell
            to="/factures"
            label="Factures en retard"
            sub={canSeeCA && retards > 0 ? <Money value={data?.montantRetard ?? 0} className="text-destructive" /> : undefined}
          >
            <CountOrCheck n={retards} tone="destructive" />
          </Cell>
          <Cell to="/stock" label="Stock bas">
            <CountOrCheck n={data?.nbStockBas ?? 0} tone="warning" />
          </Cell>
          {canSeeCA && (
            <Cell to="/clients" label="Encours clients">
              <Money value={data?.soldeTotal ?? 0} />
            </Cell>
          )}
        </Zone>

        <Zone title="Activité" cols="sm:grid-cols-3 sm:divide-x">
          <Cell to="/clients" label="Clients" sub={`${actifs} actifs · ${pctActifs} %`}>
            {clients}
          </Cell>
          <Cell to="/commandes" label="Commandes">
            {data?.nbCommandes ?? 0}
          </Cell>
          <Cell to="/tournees" label="Frais de tournée">
            <Money value={data?.fraisTournees ?? 0} />
          </Cell>
        </Zone>
      </div>

      {canSeeCA && (
        <Zone title="Trésorerie" cols="sm:grid-cols-3 sm:divide-x">
          <Cell to="/comptabilite" label="Recettes">
            <Money value={data?.recettes ?? 0} />
          </Cell>
          <Cell to="/comptabilite" label="Dépenses">
            <Money value={data?.depenses ?? 0} />
          </Cell>
          <Cell to="/comptabilite" label="Solde">
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
