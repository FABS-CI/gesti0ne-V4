import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Printer, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmbed } from "@/hooks/use-is-embed";
import {
  BonDocumentHeader,
  BonDocumentFooter,
  BonDocumentPage,
} from "@/components/pdf/BonDocumentChrome";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/bon-de-sortie/$tourneeId")({
  component: BonDeSortiePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type TourneeInfo = {
  tournee_id: string;
  reference: string;
  date_tournee: string | null;
  responsable_nom: string | null;
  chauffeur_nom: string | null;
  statut: string;
  notes: string | null;
  vehicule_id: string | null;
  cloture_mode: string | null;
  cloture_at: string | null;
};

type ColisLigne = {
  colis_id: string;
  commande_id: string | null;
  reference: string | null;
  destinataire: string | null;
  client_nom: string | null;
  ville_livraison: string | null;
  quartier: string | null;
  nb_cartons: number;
  livreur_nom: string | null;
};

async function fetchBonSortie(tourneeId: string) {
  const { data: t } = await supabase
    .from("tournees")
    .select(
      "tournee_id, reference, date_tournee, responsable_nom, chauffeur_nom, statut, notes, vehicule_id, cloture_mode, cloture_at",
    )
    .eq("tournee_id", tourneeId)
    .maybeSingle();

  let vehicule = "—";
  if (t?.vehicule_id) {
    const { data: v } = await supabase
      .from("vehicules")
      .select("immatriculation, marque, modele")
      .eq("vehicule_id", t.vehicule_id)
      .maybeSingle();
    if (v)
      vehicule = `${v.immatriculation ?? ""} ${v.marque ?? ""} ${v.modele ?? ""}`.trim() || "—";
  }

  const { data: colisRows } = await supabase
    .from("colis")
    .select(
      "colis_id, commande_id, reference, destinataire, ville_livraison, quartier, nb_cartons, livreur_nom, commandes:commande_id(client_nom)",
    )
    .eq("tournee_id" as never, tourneeId as never)
    .order("ville_livraison", { ascending: true });

  const colis: ColisLigne[] = (
    (colisRows ?? []) as unknown as Array<{
      colis_id: string;
      commande_id: string | null;
      reference: string | null;
      destinataire: string | null;
      ville_livraison: string | null;
      quartier: string | null;
      nb_cartons: number | null;
      livreur_nom: string | null;
      commandes: { client_nom: string | null } | null;
    }>
  ).map((r) => ({
    colis_id: r.colis_id,
    commande_id: r.commande_id,
    reference: r.reference,
    destinataire: r.destinataire,
    client_nom: r.commandes?.client_nom ?? null,
    ville_livraison: r.ville_livraison,
    quartier: r.quartier,
    nb_cartons: r.nb_cartons ?? 0,
    livreur_nom: r.livreur_nom,
  }));

  return { t: t as TourneeInfo | null, vehicule, colis };
}

/**
 * Contrôle de cohérence avant impression : ré-interroge la base pour la liste
 * exacte des colis affectés et recalcule les totaux ; refuse l'impression si
 * la liste ou les totaux affichés diffèrent.
 */
async function verifyBonDeSortie(
  tourneeId: string,
  displayedIds: string[],
  displayedTotals: { colis: number; cartons: number; clients: number },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data, error } = await supabase
    .from("colis")
    .select("colis_id, commande_id, nb_cartons, commandes:commande_id(client_nom)")
    .eq("tournee_id" as never, tourneeId as never);
  if (error) return { ok: false, reason: error.message };
  const rows = (data ?? []) as unknown as Array<{
    colis_id: string;
    commande_id: string | null;
    nb_cartons: number | null;
    commandes: { client_nom: string | null } | null;
  }>;
  const dbIds = new Set(rows.map((r) => r.colis_id));
  const displayedSet = new Set(displayedIds);
  if (dbIds.size !== displayedSet.size || [...dbIds].some((id) => !displayedSet.has(id))) {
    return {
      ok: false,
      reason: `La liste affichée (${displayedSet.size} colis) ne correspond pas à la base (${dbIds.size}).`,
    };
  }
  // Règle métier : 1 commande = 1 colis (peut contenir plusieurs cartons).
  // Une ligne dans la table `colis` = 1 carton physique.
  const cartons = rows.length;
  const colis = new Set(rows.map((r) => r.commande_id).filter(Boolean)).size;
  const clients = new Set(rows.map((r) => r.commandes?.client_nom).filter(Boolean)).size;
  if (
    cartons !== displayedTotals.cartons ||
    colis !== displayedTotals.colis ||
    clients !== displayedTotals.clients
  ) {
    return {
      ok: false,
      reason: `Totaux affichés (${displayedTotals.colis}c/${displayedTotals.cartons}crt/${displayedTotals.clients}cl) ≠ base (${colis}c/${cartons}crt/${clients}cl).`,
    };
  }
  return { ok: true };
}

function BonDeSortiePage() {
  const { tourneeId } = useParams({ from: "/_authenticated/bon-de-sortie/$tourneeId" });
  const isEmbed = useIsEmbed();
  const { data, isLoading } = useQuery({
    queryKey: ["bon-de-sortie", tourneeId],
    queryFn: () => fetchBonSortie(tourneeId),
  });
  const [verifying, setVerifying] = useState(false);

  if (isLoading || !data)
    return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  const { t, vehicule, colis } = data;
  if (!t) return <div className="p-8 text-sm text-muted-foreground">Tournée introuvable.</div>;

  // Règle métier : 1 commande = 1 colis (contenant N cartons).
  // Chaque ligne de la table `colis` représente un carton physique.
  const totalCartons = colis.length;
  const totalColis = new Set(colis.map((c) => c.commande_id).filter(Boolean)).size;
  const clientSet = new Set(colis.map((c) => c.client_nom).filter(Boolean));
  const totalClients = clientSet.size;

  const handlePrint = async () => {
    setVerifying(true);
    const res = await verifyBonDeSortie(
      tourneeId,
      colis.map((c) => c.colis_id),
      { colis: totalColis, cartons: totalCartons, clients: totalClients },
    );
    setVerifying(false);
    if (!res.ok) {
      toast.error("Impression bloquée — incohérence détectée", { description: res.reason });
      return;
    }
    toast.success("Cohérence vérifiée", { description: "Ouverture de l'impression…" });
    window.print();
  };

  return (
    <div className="min-h-dvh bg-background">
      {!isEmbed && (
        <div className="print:hidden flex items-center justify-between border-b p-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/tournees">
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Cohérence vérifiée avant impression
            </span>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={verifying}>
              {verifying ? (
                <AlertTriangle className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              {verifying ? "Vérification…" : "Imprimer"}
            </Button>
          </div>
        </div>
      )}

      <BonDocumentPage>
        <BonDocumentHeader
          title="Bon de sortie"
          reference={t.reference}
          date={t.date_tournee ?? ""}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
          <div>
            <span className="text-muted-foreground">Responsable :</span>
            <br />
            <b>{t.responsable_nom ?? "—"}</b>
          </div>
          <div>
            <span className="text-muted-foreground">Chauffeur :</span>
            <br />
            <b>{t.chauffeur_nom ?? "—"}</b>
          </div>
          <div>
            <span className="text-muted-foreground">Véhicule :</span>
            <br />
            <b>{vehicule}</b>
          </div>
          <div>
            <span className="text-muted-foreground">Statut :</span>
            <br />
            <b>{t.statut}</b>
            {t.statut === "terminee" && t.cloture_mode && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Clôture {t.cloture_mode === "auto" ? "automatique" : "manuelle"}
                {t.cloture_at ? ` — ${new Date(t.cloture_at).toLocaleString("fr-FR")}` : ""}
              </div>
            )}
          </div>
        </div>

        <table className="w-full border-collapse text-xs table-zebra-orange table-print-borders">
          <thead>
            <tr className="bg-muted">
              <th className="border p-1 text-left">Réf. colis</th>
              <th className="border p-1 text-left">Client</th>
              <th className="border p-1 text-left">Destinataire</th>
              <th className="border p-1 text-left">Ville / Quartier</th>
              <th className="border p-1 text-left">Livreur</th>
              <th className="border p-1 text-right">Cartons</th>
              <th className="border p-1 text-left w-24">Émargement</th>
            </tr>
          </thead>
          <tbody>
            {colis.length === 0 ? (
              <tr>
                <td colSpan={7} className="border p-3 text-center text-muted-foreground">
                  Aucun colis affecté
                </td>
              </tr>
            ) : (
              colis.map((c) => (
                <tr key={c.colis_id}>
                  <td className="border p-1 font-mono">{c.reference ?? "—"}</td>
                  <td className="border p-1">{c.client_nom ?? "—"}</td>
                  <td className="border p-1">{c.destinataire ?? "—"}</td>
                  <td className="border p-1">
                    {[c.ville_livraison, c.quartier].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="border p-1">{c.livreur_nom ?? "—"}</td>
                  <td className="border p-1 text-right">1</td>
                  <td className="border p-1">&nbsp;</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-semibold">
              <td className="border p-2" colSpan={5}>
                TOTAUX
              </td>
              <td className="border p-2 text-right">{totalCartons}</td>
              <td className="border p-2"></td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
          <div className="rounded border p-2 text-center">
            <div className="text-lg font-semibold">{totalColis}</div>
            <div className="text-muted-foreground uppercase">Colis</div>
          </div>
          <div className="rounded border p-2 text-center">
            <div className="text-lg font-semibold">{totalCartons}</div>
            <div className="text-muted-foreground uppercase">Cartons</div>
          </div>
          <div className="rounded border p-2 text-center">
            <div className="text-lg font-semibold">{totalClients}</div>
            <div className="text-muted-foreground uppercase">Clients</div>
          </div>
        </div>

        {t.notes && (
          <div className="mt-4 text-xs">
            <b>Notes :</b>
            <p className="whitespace-pre-wrap">{t.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8 mt-12 text-xs">
          <div>
            <p className="text-muted-foreground">Signature Responsable</p>
            <div className="border-t mt-16"></div>
          </div>
          <div>
            <p className="text-muted-foreground">Signature Chauffeur</p>
            <div className="border-t mt-16"></div>
          </div>
          <div>
            <p className="text-muted-foreground">Signature Gardien</p>
            <div className="border-t mt-16"></div>
          </div>
        </div>
        <BonDocumentFooter documentType="Bon de sortie" />
      </BonDocumentPage>
    </div>
  );
}
