import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  Gauge,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Truck,
  Wallet,
  Lightbulb,
} from "lucide-react";

import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { cockpitQueryOptions, type CockpitData } from "@/lib/cockpit-api";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientLink } from "@/components/common/ClientLink";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/pilotage")({
  head: () => ({
    meta: [
      { title: "Centre de pilotage — Gesti-One FABS-CI" },
      {
        name: "description",
        content: "Activité du jour et actions recommandées : impayés, préparations, livraisons, stock.",
      },
      { property: "og:title", content: "Centre de pilotage — Gesti-One FABS-CI" },
      {
        property: "og:description",
        content: "Ce qui se passe aujourd'hui dans l'ERP et ce qu'il faut traiter en priorité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pilotage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Tone = "danger" | "warning" | "info" | "success";
const TONE: Record<Tone, string> = {
  danger: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
  info: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${y}`;
};

function Pilotage() {
  const exerciceId = useExerciceConsulteId();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    cockpitQueryOptions(exerciceId),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="h-6 w-6 text-primary" /> Centre de pilotage
          </h1>
          <p className="text-sm text-muted-foreground">
            Que se passe-t-il aujourd'hui ? {data ? `— situation au ${fmtDate(data.today)}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </header>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Impossible de charger le centre de pilotage</p>
            <p className="text-sm text-muted-foreground">{error?.message}</p>
            <Button onClick={() => refetch()}>Réessayer</Button>
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : (
        <CockpitContent data={data} />
      )}
    </div>
  );
}

function CockpitContent({ data }: { data: CockpitData }) {
  const actions = buildActions(data);
  const hasAny =
    data.impayes30 ||
    data.aPreparer ||
    data.livraisonsRetard ||
    data.paiementsJour ||
    data.stockBas ||
    data.retoursAttente;

  return (
    <>
      <section aria-label="Activité du jour">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Activité du jour
        </h2>
        {!hasAny ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun indicateur disponible avec vos droits d'accès.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.impayes30 && (
              <Kpi
                tone="danger"
                icon={<Wallet className="h-5 w-5" />}
                label="Factures impayées depuis plus de 30 jours"
                value={data.impayes30.count}
                sub={formatFCFA(data.impayes30.montant)}
                to="/factures"
              />
            )}
            {data.aPreparer && (
              <Kpi
                tone="warning"
                icon={<ClipboardList className="h-5 w-5" />}
                label="Commandes à préparer"
                value={data.aPreparer.count}
                sub="bons de livraison à préparer"
                to="/colisage"
              />
            )}
            {data.livraisonsRetard && (
              <Kpi
                tone="warning"
                icon={<Truck className="h-5 w-5" />}
                label="Livraisons en retard"
                value={data.livraisonsRetard.count}
                sub="date prévue dépassée"
                to="/livraison-suivi"
              />
            )}
            {data.paiementsJour && (
              <Kpi
                tone="success"
                icon={<Wallet className="h-5 w-5" />}
                label="Paiements reçus aujourd'hui"
                value={data.paiementsJour.count}
                sub={formatFCFA(data.paiementsJour.montant)}
                to="/paiements"
              />
            )}
            {data.stockBas && (
              <Kpi
                tone="danger"
                icon={<Boxes className="h-5 w-5" />}
                label="Produits sous le seuil d'alerte"
                value={data.stockBas.count}
                sub="stock réel des dépôts"
                to="/alertes-stock"
              />
            )}
            {data.retoursAttente && (
              <Kpi
                tone="info"
                icon={<RotateCcw className="h-5 w-5" />}
                label="Retours en attente"
                value={data.retoursAttente.count}
                sub="à traiter"
                to="/retours"
              />
            )}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-warning" /> Actions recommandées
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Rien d'urgent à traiter pour le moment.
            </p>
          ) : (
            <ul className="divide-y">
              {actions.map((a) => (
                <li key={a.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.detail && <div className="mt-1 text-xs text-muted-foreground">{a.detail}</div>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={a.to}>
                      {a.cta} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.direction && <DirectionCard d={data.direction} />}
        {data.anciennete && <AncienneteCard a={data.anciennete} />}
        {data.debiteurs && data.debiteurs.items.length > 0 && (
          <ListCard title="Clients les plus débiteurs" to="/clients">
            {data.debiteurs.items.map((c) => (
              <Row key={c.client_id} right={formatFCFA(c.reste)}>
                <ClientLink clientId={c.client_id} name={c.client_nom ?? "Client"} />
              </Row>
            ))}
          </ListCard>
        )}
        {data.aPreparer && data.aPreparer.items.length > 0 && (
          <ListCard title="Préparations les plus anciennes" to="/colisage">
            {data.aPreparer.items.map((b) => (
              <Row key={b.id} right={fmtDate(b.date_bon)}>
                <Link to="/colisage/$blId" params={{ blId: b.id }} className="font-medium hover:underline">
                  {b.reference}
                </Link>{" "}
                <span className="text-muted-foreground">— {b.client_nom}</span>
              </Row>
            ))}
          </ListCard>
        )}
        {data.livraisonsRetard && data.livraisonsRetard.items.length > 0 && (
          <ListCard title="Livraisons en retard" to="/livraison-suivi">
            {data.livraisonsRetard.items.map((l) => (
              <Row key={l.id} right={fmtDate(l.date_livraison)}>
                {l.bl_id ? (
                  <Link to="/colisage/$blId" params={{ blId: l.bl_id }} className="font-medium hover:underline">
                    {l.reference ?? "Livraison"}
                  </Link>
                ) : (
                  <span className="font-medium">{l.reference ?? "Livraison"}</span>
                )}{" "}
                <span className="text-muted-foreground">— {l.client_nom}</span>
              </Row>
            ))}
          </ListCard>
        )}
        {data.stockBas && data.stockBas.items.length > 0 && (
          <ListCard title="Produits à réapprovisionner" to="/alertes-stock">
            {data.stockBas.items.map((p) => (
              <Row key={p.id} right={`${Number(p.stock)} / seuil ${Number(p.seuil)}`}>
                <Link to="/produits/$produitId" params={{ produitId: p.id }} className="font-medium hover:underline">
                  {p.titre}
                </Link>
              </Row>
            ))}
          </ListCard>
        )}
      </div>
    </>
  );
}

function Kpi(props: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  value: number;
  sub?: string;
  to: string;
}) {
  return (
    <Link
      to={props.to}
      className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start gap-3">
        <span className={`rounded-lg p-2 ${TONE[props.tone]}`}>{props.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{props.label}</p>
          <p className="text-2xl font-bold tabular-nums">{props.value}</p>
          {props.sub && <p className="truncate text-xs text-muted-foreground">{props.sub}</p>}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function ListCard({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link to={to} className="text-xs text-primary hover:underline">
          Tout voir
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">{children}</ul>
      </CardContent>
    </Card>
  );
}

function Row({ children, right }: { children: ReactNode; right?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0 truncate">{children}</div>
      {right && <span className="shrink-0 tabular-nums text-muted-foreground">{right}</span>}
    </li>
  );
}

function DirectionCard({ d }: { d: NonNullable<CockpitData["direction"]> }) {
  const rows: [string, string][] = [["Commandes (30 derniers jours)", String(d.commandes30)]];
  if (d.facture30 !== null) rows.push(["Facturé (30 derniers jours)", formatFCFA(d.facture30)]);
  if (d.encaisse30 !== null) rows.push(["Encaissé (30 derniers jours)", formatFCFA(d.encaisse30)]);
  if (d.resteTotal !== null) rows.push(["Reste à encaisser (total)", formatFCFA(d.resteTotal)]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Direction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {rows.map(([k, v]) => (
            <Row key={k} right={v}>
              {k}
            </Row>
          ))}
        </ul>
        {d.topClients && d.topClients.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Meilleurs clients (exercice)
            </p>
            <ul className="divide-y">
              {d.topClients.map((c) => (
                <Row key={c.client_id} right={formatFCFA(c.montant)}>
                  <ClientLink clientId={c.client_id} name={c.client_nom ?? "Client"} />
                </Row>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AncienneteCard({ a }: { a: NonNullable<CockpitData["anciennete"]> }) {
  const buckets: [string, number, string][] = [
    ["0 à 30 jours", a.b0_30, "bg-success"],
    ["31 à 60 jours", a.b31_60, "bg-warning"],
    ["61 à 90 jours", a.b61_90, "bg-warning"],
    ["Plus de 90 jours", a.b90p, "bg-destructive"],
  ];
  const total = Number(a.total) || 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageOpen className="h-4 w-4 text-muted-foreground" /> Impayés par ancienneté
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {buckets.map(([label, v, color]) => {
          const pct = total > 0 ? (Number(v) / total) * 100 : 0;
          return (
            <div key={label}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums">{formatFCFA(Number(v))}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between border-t pt-2 text-sm font-semibold">
          <span>Total à encaisser</span>
          <span className="tabular-nums">{formatFCFA(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

type Action = { key: string; title: string; detail?: ReactNode; to: string; cta: string };

function refs(list: string[]) {
  return list.filter(Boolean).join(", ");
}

function buildActions(d: CockpitData): Action[] {
  const out: Action[] = [];
  if (d.aPreparer && d.aPreparer.count > 0) {
    out.push({
      key: "prep",
      title: `Préparer ${d.aPreparer.count} commande${d.aPreparer.count > 1 ? "s" : ""}`,
      detail: `En priorité : ${refs(d.aPreparer.items.slice(0, 3).map((b) => b.reference))}`,
      to: "/colisage",
      cta: "Préparer",
    });
  }
  if (d.livraisonsRetard && d.livraisonsRetard.count > 0) {
    out.push({
      key: "liv",
      title: `Replanifier ${d.livraisonsRetard.count} livraison${d.livraisonsRetard.count > 1 ? "s" : ""} en retard`,
      detail: refs(d.livraisonsRetard.items.slice(0, 3).map((l) => l.reference ?? "")),
      to: "/livraison-suivi",
      cta: "Voir",
    });
  }
  if (d.impayes30 && d.impayes30.count > 0) {
    const n = new Set(d.impayes30.items.map((f) => f.client_id ?? f.client_nom)).size;
    out.push({
      key: "relance",
      title: `Relancer les clients pour ${d.impayes30.count} facture${d.impayes30.count > 1 ? "s" : ""} impayée${d.impayes30.count > 1 ? "s" : ""} depuis plus de 30 jours`,
      detail: `${formatFCFA(d.impayes30.montant)} à recouvrer — dont ${refs(
        d.impayes30.items.slice(0, 3).map((f) => `${f.reference} (${f.jours} j)`),
      )}${n > 0 ? "" : ""}`,
      to: "/factures",
      cta: "Relancer",
    });
  }
  if (d.stockBas && d.stockBas.count > 0) {
    out.push({
      key: "stock",
      title: `Réapprovisionner ${d.stockBas.count} produit${d.stockBas.count > 1 ? "s" : ""}`,
      detail: refs(d.stockBas.items.slice(0, 3).map((p) => p.titre)),
      to: "/alertes-stock",
      cta: "Voir le stock",
    });
  }
  if (d.retoursAttente && d.retoursAttente.count > 0) {
    out.push({
      key: "ret",
      title: `Traiter ${d.retoursAttente.count} retour${d.retoursAttente.count > 1 ? "s" : ""} en attente`,
      detail: refs(d.retoursAttente.items.slice(0, 3).map((r) => r.reference ?? "")),
      to: "/retours",
      cta: "Traiter",
    });
  }
  return out;
}
