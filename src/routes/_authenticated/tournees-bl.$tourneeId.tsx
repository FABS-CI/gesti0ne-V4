import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

type Tournee = {
  reference: string;
  date_tournee: string | null;
  responsable_nom: string | null;
  chauffeur_nom: string | null;
  statut: string;
  nb_colis: number;
  nb_cartons: number;
  nb_clients: number;
  notes: string | null;
  vehicule_id: string | null;
};

type Livraison = {
  livraison_id: string;
  reference: string | null;
  client_nom: string | null;
  adresse: string | null;
  transporteur: string | null;
  date_livraison: string | null;
  statut: string | null;
};

type Expedition = {
  expedition_id: string;
  reference: string | null;
  transporteur: string | null;
  tracking: string | null;
  date_depart: string | null;
  statut: string | null;
};

export const Route = createFileRoute("/_authenticated/tournees-bl/$tourneeId")({
  component: BLPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function BLPage() {
  const { tourneeId } = useParams({ from: "/_authenticated/tournees-bl/$tourneeId" });
  const [t, setT] = useState<Tournee | null>(null);
  const [vehicule, setVehicule] = useState<string>("—");
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);

  useEffect(() => {
    // Garde anti-race : un changement rapide de tourneeId ne doit pas laisser
    // la réponse d'un ancien fetch écraser l'état courant.
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tournees")
        .select("*")
        .eq("tournee_id", tourneeId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Chargement de la tournée impossible", error.message);
        return;
      }
      if (data) {
        setT(data as Tournee);
        if (data.vehicule_id) {
          const { data: v } = await supabase
            .from("vehicules")
            .select("immatriculation, marque, modele")
            .eq("vehicule_id", data.vehicule_id)
            .maybeSingle();
          if (cancelled) return;
          if (v)
            setVehicule(
              `${v.immatriculation ?? ""} ${v.marque ?? ""} ${v.modele ?? ""}`.trim() || "—",
            );
        }
      }
      const { data: lv } = await supabase
        .from("livraisons")
        .select(
          "livraison_id, reference, client_nom, adresse, transporteur, date_livraison, statut",
        )
        .eq("tournee_id", tourneeId);
      if (cancelled) return;
      setLivraisons((lv ?? []) as Livraison[]);
      // Les expéditions n'ont pas de colonne tournee_id : on passe par les livraisons de la tournée.
      const { data: lvExp } = await supabase
        .from("livraisons")
        .select("expedition_id")
        .eq("tournee_id", tourneeId)
        .not("expedition_id", "is", null);
      const expIds = [...new Set((lvExp ?? []).map((r) => r.expedition_id as string))];
      const { data: ex } = expIds.length
        ? await supabase
            .from("expeditions")
            .select("expedition_id, reference, transporteur, date_depart, statut")
            .in("expedition_id", expIds)
        : { data: [] };
      if (cancelled) return;
      setExpeditions((ex ?? []).map((e) => ({ ...e, tracking: null })) as Expedition[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [tourneeId]);

  if (!t) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-4xl p-6 print:p-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Button variant="ghost" asChild>
            <Link to="/tournees">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour
            </Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-8 print:border-0 print:p-4">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">BON DE LIVRAISON — TOURNÉE</h1>
            <p className="mt-1 text-sm text-muted-foreground">N° {t.reference}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <Info label="Date" value={t.date_tournee ?? "—"} />
            <Info label="Statut" value={t.statut} />
            <Info label="Responsable" value={t.responsable_nom ?? "—"} />
            <Info label="Chauffeur" value={t.chauffeur_nom ?? "—"} />
            <Info label="Véhicule" value={vehicule} />
            <Info label="Clients" value={String(t.nb_clients)} />
          </div>

          <h2 className="mb-2 text-sm font-bold uppercase">Livraisons ({livraisons.length})</h2>
          <table className="mb-6 w-full border-collapse text-xs table-zebra-orange table-print-borders">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-2 py-2 text-left font-semibold">Référence</th>
                <th className="px-2 py-2 text-left font-semibold">Client</th>
                <th className="px-2 py-2 text-left font-semibold">Adresse</th>
                <th className="px-2 py-2 text-left font-semibold">Date</th>
                <th className="px-2 py-2 text-left font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                    Aucune livraison liée
                  </td>
                </tr>
              ) : (
                livraisons.map((l) => (
                  <tr key={l.livraison_id} className="border-b">
                    <td className="px-2 py-2 font-mono">{l.reference ?? "—"}</td>
                    <td className="px-2 py-2">{l.client_nom ?? "—"}</td>
                    <td className="px-2 py-2">{l.adresse ?? "—"}</td>
                    <td className="px-2 py-2">{l.date_livraison ?? "—"}</td>
                    <td className="px-2 py-2">{l.statut ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <h2 className="mb-2 text-sm font-bold uppercase">Expéditions ({expeditions.length})</h2>
          <table className="mb-6 w-full border-collapse text-xs table-zebra-orange table-print-borders">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-2 py-2 text-left font-semibold">Référence</th>
                <th className="px-2 py-2 text-left font-semibold">Transporteur</th>
                <th className="px-2 py-2 text-left font-semibold">Tracking</th>
                <th className="px-2 py-2 text-left font-semibold">Départ</th>
                <th className="px-2 py-2 text-left font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {expeditions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                    Aucune expédition liée
                  </td>
                </tr>
              ) : (
                expeditions.map((e) => (
                  <tr key={e.expedition_id} className="border-b">
                    <td className="px-2 py-2 font-mono">{e.reference ?? "—"}</td>
                    <td className="px-2 py-2">{e.transporteur ?? "—"}</td>
                    <td className="px-2 py-2 font-mono">{e.tracking ?? "—"}</td>
                    <td className="px-2 py-2">{e.date_depart ?? "—"}</td>
                    <td className="px-2 py-2">{e.statut ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <Info label="Total colis" value={String(t.nb_colis)} />
            <Info label="Total cartons" value={String(t.nb_cartons)} />
          </div>

          {t.notes ? (
            <div className="mb-6 text-sm">
              <div className="font-semibold">Notes</div>
              <p className="whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
            </div>
          ) : null}

          <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
            <Signature label="Visa Chauffeur" />
            <Signature label="Visa Client / Destinataire" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-12 text-xs uppercase text-muted-foreground">{label}</div>
      <div className="border-t pt-1 text-xs text-muted-foreground">Nom, date et signature</div>
    </div>
  );
}
