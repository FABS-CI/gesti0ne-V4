import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  Truck,
  Package,
  Calculator,
  Users,
  BarChart3,
  FileCheck,
  Wallet,
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "FABS ERP — La gestion complète des PME ivoiriennes" },
      {
        name: "description",
        content:
          "ERP tout-en-un pour la Côte d'Ivoire : ventes, stock, livraison, comptabilité, paie CNPS/ITS, FNE/DGI. Temps réel, sécurisé, conçu pour vos équipes.",
      },
      { property: "og:title", content: "FABS ERP — Pilotez votre PME de A à Z" },
      {
        property: "og:description",
        content:
          "Ventes, livraisons temps réel, comptabilité, paie CI, facturation normalisée FNE. Un seul outil pour toute votre entreprise.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gesti-0ne.lovable.app/presentation" },
    ],
    links: [{ rel: "canonical", href: "https://gesti-0ne.lovable.app/presentation" }],
  }),
  component: PresentationPage,
});

const MODULES = [
  { icon: ShoppingCart, title: "Ventes", desc: "Commandes, proformas, factures, retours — cycle complet du devis au règlement." },
  { icon: Truck, title: "Livraison temps réel", desc: "Colisage, tournées, suivi étape par étape avec notifications live." },
  { icon: Package, title: "Stock & Achats", desc: "Multi-dépôts, inventaires, mouvements, fournisseurs et commandes d'achat." },
  { icon: Calculator, title: "Comptabilité", desc: "Écritures, FEC, exercices comparatifs, état de compte clients détaillé." },
  { icon: Wallet, title: "Finances", desc: "Trésorerie, paiements multi-factures, rapprochements et imputations." },
  { icon: Users, title: "Paie & RH", desc: "Bulletins CNPS, ITS, CN, CMU — barèmes CI 2024, contrats, congés, absences." },
  { icon: FileCheck, title: "FNE / DGI", desc: "Facturation normalisée intégrée, conforme à la réglementation ivoirienne." },
  { icon: BarChart3, title: "Rapports & BI", desc: "KPIs temps réel, exports PDF/CSV, tableaux de bord par métier." },
];

const STATS = [
  { value: "8+", label: "Modules métiers intégrés" },
  { value: "100%", label: "Conforme réglementation CI" },
  { value: "Live", label: "Synchronisation temps réel" },
  { value: "RBAC", label: "Sécurité par rôles" },
];

const HIGHLIGHTS = [
  "Multi-utilisateurs avec rôles et permissions fines",
  "Édition PDF sur 5 modèles configurables (factures, BL, bulletins)",
  "Réel-temps sur les livraisons et notifications",
  "Barèmes fiscaux Côte d'Ivoire à jour (CNPS, ITS, CN, CMU)",
  "Sauvegardes automatiques et audit complet",
  "API MCP : votre ERP interrogeable par IA",
];

function PresentationPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              F
            </div>
            <span className="text-lg font-bold tracking-tight">FABS ERP</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#atouts" className="hover:text-foreground">Atouts</a>
            <a href="#pourquoi" className="hover:text-foreground">Pourquoi FABS</a>
          </nav>
          <Link to="/auth">
            <Button size="sm">Se connecter</Button>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 10%, oklch(0.55 0.22 258 / 0.25), transparent), radial-gradient(500px 300px at 90% 30%, oklch(0.63 0.21 41 / 0.20), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            ERP Made in Côte d'Ivoire — Conforme FNE / DGI
          </div>
          <h1 className="ds-page-title mt-6 max-w-3xl">
            L'ERP qui gère votre PME <span className="text-primary">de A à Z</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Ventes, livraisons temps réel, stock, comptabilité, paie CNPS/ITS, facturation
            normalisée FNE. Un seul outil, pensé pour la Côte d'Ivoire, prêt à l'emploi.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Démarrer maintenant <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline">
                Découvrir les modules
              </Button>
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                <div className="text-3xl font-bold text-primary">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold uppercase tracking-wider text-accent">
            Modules intégrés
          </div>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">
            Tout ce dont votre entreprise a besoin.
          </h2>
          <p className="mt-4 text-muted-foreground">
            8 modules métiers connectés entre eux, avec des données partagées et une vue
            temps réel sur toute votre activité.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ATOUTS */}
      <section id="atouts" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-accent">
              Atouts
            </div>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">
              Conçu pour vos équipes, pas contre elles.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Interface claire, temps réel partout, exports PDF professionnels, sécurité
              enterprise. FABS ERP a été audité, testé et documenté pour la production.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {HIGHLIGHTS.map((h) => (
                <div key={h} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm">{h}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card icon={ShieldCheck} title="Sécurité RBAC v2" desc="Rôles séparés, permissions fines, audit trail complet." />
            <Card icon={Zap} title="Temps réel" desc="Livraisons, notifications, dashboards — tout se met à jour instantanément." />
            <Card icon={Globe} title="Fait pour la CI" desc="FCFA, gares, communes, barèmes fiscaux à jour." />
            <Card icon={FileCheck} title="Documents pro" desc="PDF factures, BL, bulletins de paie, rapports — 5 modèles au choix." />
          </div>
        </div>
      </section>

      {/* POURQUOI */}
      <section id="pourquoi" className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-10 md:p-16">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">
            Remplacez 5 outils par un seul.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Fini les fichiers Excel dispersés, les logiciels de compta déconnectés du
            stock, les bulletins de paie faits à la main. FABS ERP centralise tout.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Se connecter <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} FABS ERP — Côte d'Ivoire</div>
          <div className="flex gap-6">
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#atouts" className="hover:text-foreground">Atouts</a>
            <Link to="/auth" className="hover:text-foreground">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}