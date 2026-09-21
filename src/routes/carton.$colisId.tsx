import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Package, Truck, FileDown, Globe, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import fabsLogoUrl from "@/assets/fabs-logo.png";

/**
 * Page publique de consultation d'un carton via QR code.
 *
 * - Accessible sans authentification (RPC `get_carton_public` exposée à `anon`).
 * - Rendue hors du layout `_authenticated` : pas d'AppShell, pas de redirect vers /auth.
 * - N'affiche AUCUNE donnée financière (prix, remises, coûts, marges).
 */
export const Route = createFileRoute("/carton/$colisId")({
  ssr: false,
  component: CartonPublicPage,
  head: () => ({
    meta: [
      { title: "Suivi du carton — FABS-CI" },
      {
        name: "description",
        content: "Consultation publique des informations logistiques d'un carton FABS-CI.",
      },
      { property: "og:title", content: "Suivi du carton — FABS-CI" },
      {
        property: "og:description",
        content: "Consultation publique des informations logistiques d'un carton FABS-CI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const BLUE = "var(--fabsci-blue-electric)";
const SITE_OFFICIEL = "https://editions-fabsci.lovable.app/";

type CartonPublic = {
  colis_id: string;
  reference_colis: string;
  numero_carton: number | null;
  nb_cartons: number | null;
  bl_reference: string | null;
  bl_statut: string | null;
  commande_reference: string | null;
  client_nom: string | null;
  etablissement: string | null;
  destinataire: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  destination: string | null;
  mode_acheminement: "livraison" | "expedition" | null;
  statut_logistique: string | null;
  date_colisage: string | null;
  preparateur: string | null;
  observations: string | null;
  produits: { designation: string | null; quantite: number }[];
};

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function statutLabel(s: string | null): string {
  if (!s) return "EN COURS";
  return s.replace(/_/g, " ").toUpperCase();
}

function CartonPublicPage() {
  const { colisId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["carton-public", colisId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_carton_public", { _colis_id: colisId });
      if (error) throw error;
      return data as unknown as CartonPublic | null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <Package className="h-12 w-12 text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-800">Carton introuvable</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Ce QR code ne correspond à aucun carton actif. Vérifiez que vous scannez bien un sticker
          imprimé par le service logistique.
        </p>
      </div>
    );
  }

  const client = data.etablissement ?? data.client_nom ?? "—";
  const destination = data.destination || data.ville || "—";

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      {/* En-tête premium */}
      <header className="bg-white px-4 pb-6 pt-7 shadow-sm">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <img src={fabsLogoUrl} alt="Éditions FABS-CI" className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">SUIVI DU CARTON</h1>
            <p className="text-sm text-slate-500">Consultation logistique</p>
          </div>
          <span
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700"
            aria-label="Statut du carton"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {statutLabel(data.statut_logistique ?? data.bl_statut)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {/* Références */}
        <Card>
          <Row label="Carton" value={`${data.numero_carton ?? "?"} / ${data.nb_cartons ?? "?"}`} accent />
          <Row label="Bon de livraison" value={data.bl_reference} mono accent />
          <Row label="Commande" value={data.commande_reference} mono />
          <Row label="Colisage" value={data.reference_colis} mono />
        </Card>

        {/* Client */}
        <Card title="Client">
          <div className="space-y-4 px-4 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Client
              </div>
              <div
                className="break-words text-lg font-bold leading-snug"
                style={{ color: BLUE }}
              >
                {client}
              </div>
            </div>

            {(data.destinataire || data.telephone) && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Responsable / Contact
                </div>
                {data.destinataire && (
                  <div className="break-words font-semibold text-slate-900">{data.destinataire}</div>
                )}
                {data.telephone && (
                  <a href={`tel:${data.telephone}`} className="font-semibold underline" style={{ color: BLUE }}>
                    {data.telephone}
                  </a>
                )}
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Destination
              </div>
              <div className="break-words text-lg font-bold uppercase" style={{ color: BLUE }}>
                {destination}
              </div>
              {data.adresse && <div className="text-sm text-slate-600">{data.adresse}</div>}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Truck className="h-4 w-4 shrink-0" />
              {data.mode_acheminement === "expedition" ? "Expédition" : "Livraison"}
              {data.date_colisage && <span>· {formatDateFr(data.date_colisage)}</span>}
            </div>
          </div>
        </Card>

        {/* Contenu */}
        <Card title={`Contenu du carton — ${data.produits?.length ?? 0} article(s)`}>
          {(data.produits ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Aucun détail produit disponible.</p>
          ) : (
            <table className="w-full table-fixed text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-2/3 p-3 font-semibold">Désignation</th>
                  <th className="p-3 text-right font-semibold">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {data.produits.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="break-words p-3">{p.designation ?? "—"}</td>
                    <td className="p-3 text-right font-semibold">{p.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <BlDownload colisId={colisId} blReference={data.bl_reference} clientNom={client} />

        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Référence du carton vérifiée — document identifié par QR code
        </div>

        <footer className="pt-4 text-center text-xs leading-relaxed text-slate-400">
          <div className="font-semibold text-slate-500">EDITIONS FABS-CI</div>
          <div>Consultation logistique — Lecture seule</div>
          <div>© FABS-CI — Tous droits réservés</div>
        </footer>
      </main>
    </div>
  );
}

function BlDownload({
  colisId,
  blReference,
  clientNom,
}: {
  colisId: string;
  blReference: string | null;
  clientNom: string;
}) {
  const [state, setState] = useState<"idle" | "generating" | "downloading">("idle");
  const [unavailable, setUnavailable] = useState(false);

  const busy = state !== "idle";

  const handleDownload = async () => {
    if (busy) return;
    setUnavailable(false);
    setState("generating");
    try {
      const res = await fetch(`/api/public/carton/${colisId}/bl`, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        setUnavailable(true);
        setState("idle");
        return;
      }
      const payload = await res.json();
      const { generateUnifiedCommercialPDF } = await import("@/lib/pdf/unified-generator");
      const blob = await generateUnifiedCommercialPDF("Bon de Livraison", payload);
      setState("downloading");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${payload.reference || blReference || "bon-de-livraison"} - ${clientNom}.pdf`.replace(
        /[\\/:*?"<>|]/g,
        "-",
      );
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setUnavailable(true);
    } finally {
      setState("idle");
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-center text-sm font-bold uppercase tracking-wide text-white shadow-sm transition disabled:opacity-70"
        style={{ backgroundColor: BLUE }}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
        {state === "generating"
          ? "Génération du bon de livraison…"
          : state === "downloading"
            ? "Téléchargement en cours…"
            : "Télécharger le bon de livraison"}
      </button>

      {unavailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Bon de livraison indisponible</div>
          <p>
            Le document correspondant à ce carton n'est actuellement pas disponible au
            téléchargement.
          </p>
        </div>
      )}

      <a
        href={SITE_OFFICIEL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Globe className="h-4 w-4" />
        Aller sur le site officiel
      </a>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </div>
      )}
      <div className="divide-y">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`break-all text-right font-bold ${mono ? "font-mono" : ""}`}
        style={accent ? { color: BLUE } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
