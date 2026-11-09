import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { StatusPill } from "@/components/common/StatusPill";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

interface Props {
  data: DashboardOverview | undefined;
  canSeeCA: boolean;
}

type To =
  | "/clients"
  | "/commandes"
  | "/paiements"
  | "/factures"
  | "/stock"
  | "/tournees"
  | "/comptabilite";

function Money({ value }: { value: number }) {
  return (
    <span title={formatFCFA(value)}>
      <AnimatedNumber value={value} format={formatFCFACompact} />
      <span className="ml-1 text-xs font-normal text-muted-foreground">FCFA</span>
    </span>
  );
}

/** Mini-courbe SVG (uniquement si un historique réel existe). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Evolution({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (!previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <StatusPill tone={up ? "success" : "danger"} dot={false}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")} %
      </StatusPill>
      <span>{label}</span>
    </div>
  );
}

function Kpi({
  to,
  label,
  children,
  sub,
  footer,
}: {
  to: To;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="dash-lift block min-w-0 rounded-[14px] border bg-card p-5 shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="ds-label truncate">{label}</p>
      <div className="mt-2 truncate text-[26px] font-semibold leading-tight tracking-tight tabular-nums text-foreground">
        {children}
      </div>
      {sub ? <div className="mt-2 text-xs text-muted-foreground">{sub}</div> : null}
      {footer}
    </Link>
  );
}

const GRID = "dash-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

export function DashboardKpis({ data, canSeeCA }: Props) {
  const facture = data?.montantFacture ?? 0;
  const reste = data?.resteAEncaisser ?? 0;
  const taux = Math.max(0, Math.min(100, data?.tauxEncaissement ?? 0));
  const clients = data?.clientsTotal ?? 0;
  const actifs = data?.clientsActifs ?? 0;
  const pctActifs = clients > 0 ? Math.round((actifs / clients) * 100) : 0;
  const mensuel = (data?.caMensuel ?? []).map((m) => m.ca);
  const last = mensuel.at(-1) ?? 0;
  const prev = mensuel.at(-2) ?? 0;

  return (
    <div className="space-y-4">
      {canSeeCA && (
        <div className={GRID}>
          <Kpi
            to="/paiements"
            label="Chiffre d'affaires encaissé"
            footer={
              <>
                <Evolution current={last} previous={prev} label="ce mois vs mois précédent" />
                <Sparkline values={mensuel} />
              </>
            }
          >
            <Money value={data?.caTotal ?? 0} />
          </Kpi>
          <Kpi to="/factures" label="Montant facturé">
            <Money value={facture} />
          </Kpi>
          <Kpi
            to="/factures"
            label="Reste à encaisser"
            sub={
              facture > 0
                ? `${((reste / facture) * 100).toFixed(1).replace(".", ",")} % du facturé`
                : undefined
            }
          >
            <Money value={reste} />
          </Kpi>
          <Kpi
            to="/paiements"
            label="Taux d'encaissement"
            footer={
              <span className="mt-3 block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span className="dash-bar block h-full bg-primary" style={{ width: `${taux}%` }} />
              </span>
            }
          >
            <AnimatedNumber
              value={data?.tauxEncaissement ?? 0}
              decimals={1}
              format={(n) => `${n.toFixed(1).replace(".", ",")} %`}
            />
          </Kpi>
        </div>
      )}

      <div className={GRID}>
        <Kpi to="/clients" label="Clients" sub={`${actifs} actifs · ${pctActifs} %`}>
          <AnimatedNumber value={clients} />
        </Kpi>
        <Kpi to="/commandes" label="Commandes">
          <AnimatedNumber value={data?.nbCommandes ?? 0} />
        </Kpi>
        {canSeeCA && (
          <Kpi to="/clients" label="Encours clients">
            <Money value={data?.soldeTotal ?? 0} />
          </Kpi>
        )}
        <Kpi to="/tournees" label="Frais de tournée">
          <Money value={data?.fraisTournees ?? 0} />
        </Kpi>
      </div>

      {canSeeCA && (
        <div className="dash-stagger grid gap-4 sm:grid-cols-3">
          <Kpi to="/comptabilite" label="Recettes">
            <Money value={data?.recettes ?? 0} />
          </Kpi>
          <Kpi to="/comptabilite" label="Dépenses">
            <Money value={data?.depenses ?? 0} />
          </Kpi>
          <Kpi to="/comptabilite" label="Solde de trésorerie">
            <Money value={data?.solde ?? 0} />
          </Kpi>
        </div>
      )}
    </div>
  );
}
