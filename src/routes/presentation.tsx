import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "GESTI-one — Gestion commerciale, stock, comptabilité et paie" },
      {
        name: "description",
        content:
          "GESTI-one, logiciel de gestion d'Éditions FABS-CI : ventes, stock, livraisons, comptabilité, paie CNPS/ITS et facturation normalisée FNE/DGI.",
      },
      { property: "og:title", content: "GESTI-one — Gestion commerciale, stock, comptabilité et paie" },
      {
        property: "og:description",
        content: "Ventes, stock, livraisons, comptabilité et paie conformes FNE/DGI, CNPS et ITS, pour les entreprises ivoiriennes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresentationPage,
});

const MODULES = [
  { nom: "Ventes", fait: "Proformas, commandes, factures, bons de livraison, retours et avoirs.", remplace: "Factures faites sur tableur ou à la main" },
  { nom: "Stock et achats", fait: "Plusieurs dépôts, inventaires, transferts, seuils d'alerte, commandes fournisseurs.", remplace: "Fiches de stock papier" },
  { nom: "Livraison", fait: "Colisage, étiquettes, tournées, bon de sortie, remise signée au client.", remplace: "Suivi par téléphone" },
  { nom: "Encaissements", fait: "Paiements sur une ou plusieurs factures, relevés et état de compte des clients.", remplace: "Cahier des encaissements" },
  { nom: "Comptabilité", fait: "Écritures générées depuis les ventes et achats, grand livre, clôture d'exercice.", remplace: "Ressaisie dans un logiciel séparé" },
  { nom: "Paie et RH", fait: "Bulletins CNPS, ITS, CN et CMU, contrats, congés et absences.", remplace: "Calcul de paie sur tableur" },
];

const CONFORMITE = [
  ["Facturation normalisée", "Les factures sont transmises à la FNE de la DGI et portent un QR code de vérification."],
  ["Paie", "Les cotisations CNPS et l'ITS sont calculées selon les barèmes en vigueur en Côte d'Ivoire."],
  ["Journal d'audit", "Chaque création, modification et suppression est enregistrée avec l'auteur et l'heure."],
  ["Sauvegardes", "Une copie complète des données est faite toutes les trois heures, avec une copie sur Google Drive."],
  ["Contrôle d'accès", "Chaque utilisateur ne voit et ne modifie que ce que son rôle autorise, dépôt par dépôt."],
];

function PresentationPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-4">
          <span className="text-base font-semibold">GESTI-one</span>
          <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#conformite" className="hover:text-foreground">Conformité</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <Button asChild size="sm"><Link to="/auth">Se connecter</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6">
        <section className="border-b border-border py-16">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
            Gestion commerciale, stock, comptabilité et paie, conforme FNE/DGI.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Un seul logiciel pour suivre une vente de la proforma jusqu'au paiement, avec le stock, la livraison et la comptabilité mis à jour au même moment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild><Link to="/auth">Se connecter</Link></Button>
            <Button asChild variant="outline">
              <a href={`mailto:${COMPANY.email}?subject=Demande de démonstration GESTI-one`}>Demander une démonstration</a>
            </Button>
          </div>
        </section>

        <section id="modules" className="border-b border-border py-16">
          <h2 className="text-xl font-semibold">Modules</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-semibold">Module</th>
                  <th className="py-2 pr-4 font-semibold">Ce qu'il fait</th>
                  <th className="py-2 font-semibold">Ce qu'il remplace</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.nom} className="border-b border-border align-top">
                    <td className="py-3 pr-4 font-medium">{m.nom}</td>
                    <td className="py-3 pr-4">{m.fait}</td>
                    <td className="py-3 text-muted-foreground">{m.remplace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="conformite" className="border-b border-border py-16">
          <h2 className="text-xl font-semibold">Conformité et fiabilité</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {CONFORMITE.map(([t, d]) => (
              <div key={t}>
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer id="contact" className="mx-auto max-w-[1100px] px-6 py-10 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Éditeur : Éditions FABS-CI</p>
        <p className="mt-1">{COMPANY.adresse}</p>
        <p className="mt-1">
          {COMPANY.telephones.join(" · ")} ·{" "}
          <a href={`mailto:${COMPANY.email}`} className="underline-offset-4 hover:underline">{COMPANY.email}</a>
        </p>
        <p className="mt-4 text-xs">GESTI-one · version 1.0.0 · © {new Date().getFullYear()} Éditions FABS-CI</p>
      </footer>
    </div>
  );
}
