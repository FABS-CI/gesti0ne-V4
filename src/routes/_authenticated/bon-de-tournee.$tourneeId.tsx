import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { formatFCFA, formatDate } from "@/lib/format";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportListePDF } from "@/lib/pdf/exportListe";
import { useIsEmbed } from "@/hooks/use-is-embed";
import { useAuth } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/company";
import { QrCode, Barcode } from "@/components/pdf/CodeVisuals";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const STATUT_META: Record<string, { label: string }> = {
  preparee: { label: "Préparée" },
  chargee: { label: "Chargée" },
  en_cours: { label: "En cours" },
  en_route: { label: "En route" },
  terminee: { label: "Terminée" },
  partiellement_terminee: { label: "Partiellement terminée" },
  livree: { label: "Livrée" },
  expediee: { label: "Expédiée" },
  deposee_gare: { label: "Déposée gare" },
  arrivee_destination: { label: "Arrivée destination" },
  retiree_client: { label: "Retirée client" },
  retiree: { label: "Retirée" },
  anomalie: { label: "Anomalie" },
  retour: { label: "Retour" },
  annulee: { label: "Annulée" },
  en_attente: { label: "En attente" },
  assignee: { label: "Assignée" },
};

export const Route = createFileRoute("/_authenticated/bon-de-tournee/$tourneeId")({
  component: FeuilleTourneePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type TourneeInfo = {
  tournee_id: string;
  reference: string;
  date_tournee: string | null;
  heure_depart: string | null;
  responsable_nom: string | null;
  chauffeur_nom: string | null;
  statut: string;
  notes: string | null;
  vehicule_id: string | null;
  type_tournee: string | null;
  depot_depart_id: string | null;
  distance_km: number | null;
  nb_livraisons: number | null;
  created_at: string | null;
};

type Vehicule = {
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  type: string | null;
  capacite: number | null;
};

type Depot = {
  nom: string | null;
  adresse: string | null;
  ville: string | null;
  commune: string | null;
  telephone: string | null;
};

type LigneFeuille = {
  livraison_id: string;
  commande_id: string | null;
  commande_reference: string | null;
  facture_reference: string | null;
  facture_montant: number | null;
  facture_paye: number | null;
  facture_reste: number | null;
  facture_mode: string | null;
  client_nom: string | null;
  contact: string | null;
  telephone: string | null;
  adresse: string | null;
  commune: string | null;
  ville_livraison: string | null;
  gare_nom: string | null;
  type_livraison: string | null;
  transporteur: string | null;
  preparateur: string | null;
  nb_cartons: number;
  nb_colis_cmd: number;
  poids: number;
  quantite_commandee: number;
  statut: string;
};

type ColisLigne = {
  colis_id: string;
  reference: string | null;
  destinataire: string | null;
  client_nom: string | null;
  ville_livraison: string | null;
  commune: string | null;
  quartier: string | null;
  nb_cartons: number;
  poids: number;
  livreur_nom: string | null;
  responsable_nom: string | null;
};

type FeuilleData = {
  t: TourneeInfo | null;
  vehicule: Vehicule | null;
  depot: Depot | null;
  lignes: LigneFeuille[];
  colis: ColisLigne[];
};

async function fetchFeuille(tourneeId: string): Promise<FeuilleData> {
  const { data: t } = await supabase
    .from("tournees")
    .select(
      "tournee_id, reference, date_tournee, heure_depart, responsable_nom, chauffeur_nom, statut, notes, vehicule_id, type_tournee, depot_depart_id, distance_km, nb_livraisons, created_at",
    )
    .eq("tournee_id", tourneeId)
    .maybeSingle();

  let vehicule: Vehicule | null = null;
  if (t?.vehicule_id) {
    const { data: v } = await supabase
      .from("vehicules")
      .select("immatriculation, marque, modele, type, capacite")
      .eq("vehicule_id", t.vehicule_id)
      .maybeSingle();
    vehicule = (v as Vehicule) ?? null;
  }

  let depot: Depot | null = null;
  if (t?.depot_depart_id) {
    const { data: d } = await supabase
      .from("depots")
      .select("nom, adresse, ville, commune, telephone")
      .eq("depot_id", t.depot_depart_id)
      .maybeSingle();
    depot = (d as Depot) ?? null;
  }

  const { data: rows } = await supabase
    .from("livraisons_commande")
    .select(
      "livraison_id, statut, type_livraison, gare_nom, ville_livraison, nb_cartons, quantite_commandee, transporteur, commande_id, commandes:commande_id(reference, client_id, client_nom, representant_nom, telephone, adresse, ville, commercial_nom, montant_ttc, net_a_payer, montant_total)",
    )
    .eq("tournee_id", tourneeId)
    .order("ville_livraison", { ascending: true });

  type Row = {
    livraison_id: string;
    statut: string;
    type_livraison: string | null;
    gare_nom: string | null;
    ville_livraison: string | null;
    nb_cartons: number | null;
    quantite_commandee: number | null;
    transporteur: string | null;
    commande_id: string | null;
    commandes: {
      reference: string | null;
      client_id: string | null;
      client_nom: string | null;
      representant_nom: string | null;
      telephone: string | null;
      adresse: string | null;
      ville: string | null;
      commercial_nom: string | null;
      montant_ttc: number | null;
      net_a_payer: number | null;
      montant_total: number | null;
    } | null;
  };
  const list = (rows ?? []) as unknown as Row[];

  // Fetch client details + factures + colis in parallel
  const clientIds = Array.from(
    new Set(list.map((r) => r.commandes?.client_id).filter(Boolean) as string[]),
  );
  const commandeIds = Array.from(
    new Set(list.map((r) => r.commande_id).filter(Boolean) as string[]),
  );

  const [clientsRes, facturesRes, colisRes] = await Promise.all([
    clientIds.length
      ? supabase
          .from("clients")
          .select("client_id, telephone, adresse, commune, ville")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as unknown[] }),
    commandeIds.length
      ? supabase
          .from("factures")
          .select("commande_id, reference, montant_total, montant_paye, statut")
          .in("commande_id", commandeIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("colis")
      .select(
        "colis_id, reference, destinataire, ville_livraison, commune, quartier, nb_cartons, poids, livreur_nom, responsable_nom, commande_id, commandes:commande_id(client_nom)",
      )
      .eq("tournee_id" as never, tourneeId as never)
      .order("ville_livraison", { ascending: true }),
  ]);

  const clientMap = new Map<
    string,
    {
      telephone: string | null;
      adresse: string | null;
      commune: string | null;
      ville: string | null;
    }
  >();
  (
    (clientsRes.data ?? []) as Array<{
      client_id: string;
      telephone: string | null;
      adresse: string | null;
      commune: string | null;
      ville: string | null;
    }>
  ).forEach((c) => {
    clientMap.set(c.client_id, c);
  });


  const factureMap = new Map<
    string,
    { reference: string | null; montant: number; paye: number; statut: string | null }
  >();
  (
    (facturesRes.data ?? []) as Array<{
      commande_id: string | null;
      reference: string | null;
      montant_total: number | null;
      montant_paye: number | null;
      statut: string | null;
    }>
  ).forEach((f) => {
    if (!f.commande_id) return;
    // keep the biggest / latest
    factureMap.set(f.commande_id, {
      reference: f.reference,
      montant: Number(f.montant_total ?? 0),
      paye: Number(f.montant_paye ?? 0),
      statut: f.statut,
    });
  });

  // Regroupement colis par commande pour compter cartons + poids sur la ligne
  const colisRaw = (colisRes.data ?? []) as Array<{
    colis_id: string;
    reference: string | null;
    destinataire: string | null;
    ville_livraison: string | null;
    commune: string | null;
    quartier: string | null;
    nb_cartons: number | null;
    poids: number | null;
    livreur_nom: string | null;
    responsable_nom: string | null;
    commande_id: string | null;
    commandes: { client_nom: string | null } | null;
  }>;
  const cmdColisAgg = new Map<
    string,
    { cartons: number; poids: number; nbColis: number; preparateur: string | null }
  >();
  colisRaw.forEach((c) => {
    if (!c.commande_id) return;
    const prev = cmdColisAgg.get(c.commande_id) ?? {
      cartons: 0,
      poids: 0,
      nbColis: 0,
      preparateur: null as string | null,
    };
    cmdColisAgg.set(c.commande_id, {
      cartons: prev.cartons + 1, // 1 ligne colis = 1 carton
      poids: prev.poids + Number(c.poids ?? 0),
      nbColis: prev.nbColis + 1,
      preparateur: prev.preparateur ?? c.responsable_nom ?? null,
    });
  });

  const lignes: LigneFeuille[] = list.map((r, idx) => {
    const cmd = r.commandes;
    const cli = cmd?.client_id ? clientMap.get(cmd.client_id) : null;
    const fac = r.commande_id ? factureMap.get(r.commande_id) : null;
    const agg = r.commande_id ? cmdColisAgg.get(r.commande_id) : null;
    const netAPayer = Number(cmd?.net_a_payer ?? cmd?.montant_ttc ?? cmd?.montant_total ?? 0);
    const factureMontant = fac ? fac.montant : netAPayer;
    const factureReste = fac ? Math.max(0, fac.montant - fac.paye) : netAPayer;
    return {
      livraison_id: r.livraison_id,
      commande_id: r.commande_id,
      commande_reference: cmd?.reference ?? null,
      facture_reference: fac?.reference ?? null,
      facture_montant: factureMontant,
      facture_paye: fac?.paye ?? 0,
      facture_reste: factureReste,
      facture_mode: null,
      client_nom: cmd?.client_nom ?? null,
      contact: cmd?.representant_nom ?? null,
      telephone: cmd?.telephone ?? cli?.telephone ?? null,

      adresse: cmd?.adresse ?? cli?.adresse ?? null,
      commune: cli?.commune ?? null,
      ville_livraison: r.ville_livraison ?? cmd?.ville ?? cli?.ville ?? null,
      gare_nom: r.gare_nom,
      type_livraison: r.type_livraison,
      transporteur: r.transporteur,
      preparateur: agg?.preparateur ?? null,
      nb_cartons: agg?.cartons ?? r.nb_cartons ?? 0,
      nb_colis_cmd: agg?.nbColis ?? 1,
      poids: agg?.poids ?? 0,
      quantite_commandee: r.quantite_commandee ?? 0,
      statut: r.statut,
      // idx used only to keep TS happy
      _idx: idx,
    } as unknown as LigneFeuille;
  });

  const colis: ColisLigne[] = colisRaw.map((r) => ({
    colis_id: r.colis_id,
    reference: r.reference,
    destinataire: r.destinataire,
    client_nom: r.commandes?.client_nom ?? null,
    ville_livraison: r.ville_livraison,
    commune: r.commune,
    quartier: r.quartier,
    nb_cartons: 1,
    poids: Number(r.poids ?? 0),
    livreur_nom: r.livreur_nom,
    responsable_nom: r.responsable_nom,
  }));

  return { t: t as TourneeInfo | null, vehicule, depot, lignes, colis };
}

function fmt(n: number): string {
  return formatFCFA(Math.round(n), false)
    .replace(/[\u00a0\u202f]/g, " ");
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div className="text-xs leading-tight">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function FeuilleTourneePage() {
  const { tourneeId } = useParams({ from: "/_authenticated/bon-de-tournee/$tourneeId" });
  const isEmbed = useIsEmbed();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["feuille-tournee-v2", tourneeId],
    queryFn: () => fetchFeuille(tourneeId),
  });

  if (isLoading || !data)
    return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  const { t, vehicule, depot, lignes, colis } = data;
  if (!t) return <div className="p-8 text-sm text-muted-foreground">Tournée introuvable.</div>;

  const bonRef = `BT-${t.reference}`;
  const vehiculeLabel = vehicule
    ? `${vehicule.immatriculation ?? ""} ${vehicule.marque ?? ""} ${vehicule.modele ?? ""}`.trim() ||
      "—"
    : "—";

  // Totaux enrichis
  const nbLivraisons = lignes.length;
  const totalCartons = lignes.reduce((s, l) => s + (l.nb_cartons || 0), 0);
  const totalColis = lignes.reduce((s, l) => s + (l.nb_colis_cmd || 0), 0);
  const totalQte = lignes.reduce((s, l) => s + (l.quantite_commandee || 0), 0);
  const totalPoids = lignes.reduce((s, l) => s + (l.poids || 0), 0);
  const clientsSet = new Set(lignes.map((l) => l.client_nom).filter(Boolean));
  const facturesSet = new Set(lignes.map((l) => l.facture_reference).filter(Boolean));
  const commandesSet = new Set(lignes.map((l) => l.commande_reference).filter(Boolean));
  const montantTransporte = lignes.reduce((s, l) => s + (l.facture_montant || 0), 0);
  const montantEncaisse = lignes.reduce((s, l) => s + (l.facture_paye || 0), 0);
  const montantRestant = lignes.reduce((s, l) => s + (l.facture_reste || 0), 0);
  const nbReussies = lignes.filter((l) =>
    ["livree", "retiree_client", "arrivee_destination"].includes(l.statut),
  ).length;
  const nbAnomalies = lignes.filter((l) => l.statut === "anomalie").length;
  const nbRetours = lignes.filter((l) => l.statut === "retour").length;
  const totalCartonsColis = colis.length;

  const handlePdf = () => {
    exportListePDF({
      titre: `Bon de tournée ${t.reference}`,
      filtres: [
        `Date : ${t.date_tournee ?? "—"}`,
        `Responsable : ${t.responsable_nom ?? "—"}`,
        `Chauffeur : ${t.chauffeur_nom ?? "—"}`,
        `Véhicule : ${vehiculeLabel}`,
      ],
      colonnes: [
        "N°",
        "Commande",
        "Facture",
        "Client",
        "Contact",
        "Téléphone",
        "Ville",
        "Cartons",
        "Qté",
        "Montant",
        "À encaisser",
        "Statut",
      ],
      lignes: lignes.map((l, i) => [
        i + 1,
        l.commande_reference ?? "—",
        l.facture_reference ?? "—",
        l.client_nom ?? "—",
        l.contact ?? "—",
        l.telephone ?? "—",
        l.ville_livraison ?? "—",
        l.nb_cartons,
        l.quantite_commandee,
        fmt(l.facture_montant ?? 0),
        fmt(l.facture_reste ?? 0),
        STATUT_META[l.statut]?.label ?? l.statut,
      ]),
      filename: `bon-tournee-${t.reference}`,
    });
  };

  const dateEdition = new Date().toLocaleDateString("fr-FR");
  const heureEdition = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-dvh bg-background">
      {!isEmbed && (
        <div className="print:hidden flex items-center justify-between border-b p-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/tournees">
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimer
            </Button>
            <Button size="sm" onClick={handlePdf}>
              <FileDown className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm print:p-6 print:max-w-none">
        {/* En-tête entreprise + QR + Barcode */}
        <div className="flex justify-between items-start mb-4 border-b-2 border-border pb-3">
          <div className="max-w-[55%]">
            <h1 className="ds-page-title">{COMPANY.nom}</h1>
            <p className="text-xs text-muted-foreground leading-snug">{COMPANY.adresse}</p>
            <p className="text-xs text-muted-foreground">
              Tél : {COMPANY.telephones.join(" / ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Email : {COMPANY.email}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{COMPANY.slogan}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">Bon de tournée</h2>
            <p className="text-sm font-mono">{bonRef}</p>
            <p className="text-xs">N° tournée : <b>{t.reference}</b></p>
            {t.date_tournee && <p className="text-xs">Date : {formatDate(t.date_tournee)}</p>}
            <div className="flex justify-end gap-2 mt-2 items-start">
              <div className="text-center">
                <QrCode value={`${bonRef}|${t.reference}`} size={64} />
                <div className="text-xs text-muted-foreground mt-0.5">QR bon</div>
              </div>
            </div>
          </div>
        </div>

        {/* Code-barres */}
        <div className="flex justify-end mb-3">
          <Barcode value={t.reference} width={200} height={34} />
        </div>

        {/* Informations tournée */}
        <div className="grid grid-cols-4 gap-x-3 gap-y-2 mb-4 border rounded p-3 bg-muted">
          <Field label="Responsable" value={t.responsable_nom ?? "—"} />
          <Field label="Chauffeur" value={t.chauffeur_nom ?? "—"} />
          <Field label="Transporteur" value={lignes[0]?.transporteur ?? undefined} />
          <Field label="Type tournée" value={t.type_tournee ?? undefined} />
          <Field label="Véhicule" value={vehiculeLabel} />
          <Field label="Immatriculation" value={vehicule?.immatriculation ?? undefined} />
          <Field label="Type véhicule" value={vehicule?.type ?? undefined} />
          <Field label="Capacité" value={vehicule?.capacite ? `${vehicule.capacite}` : undefined} />
          <Field label="Dépôt départ" value={depot?.nom ?? undefined} />
          <Field
            label="Adresse dépôt"
            value={
              depot
                ? [depot.adresse, depot.commune, depot.ville].filter(Boolean).join(", ")
                : undefined
            }
          />
          <Field label="Heure de départ" value={t.heure_depart ?? undefined} />
          <Field
            label="Distance"
            value={t.distance_km ? `${t.distance_km} km` : undefined}
          />
          <Field
            label="Créé le"
            value={t.created_at ? new Date(t.created_at).toLocaleString("fr-FR") : undefined}
          />
          <Field label="Statut" value={STATUT_META[t.statut]?.label ?? t.statut} />
        </div>

        {/* Tableau enrichi des livraisons */}
        <table className="w-full border-collapse text-xs table-zebra-orange table-print-borders">
          <thead>
            <tr className="bg-muted">
              <th className="border p-1 text-left">N°</th>
              <th className="border p-1 text-left">Cmd / Facture</th>
              <th className="border p-1 text-left">Client</th>
              <th className="border p-1 text-left">Contact / Tél</th>
              <th className="border p-1 text-left">Adresse</th>
              <th className="border p-1 text-left">Ville / Commune</th>
              <th className="border p-1 text-right">Cart.</th>
              <th className="border p-1 text-right">Qté</th>
              <th className="border p-1 text-right">Poids</th>
              <th className="border p-1 text-right">Montant</th>
              <th className="border p-1 text-right">À enc.</th>
              <th className="border p-1 text-left">Statut</th>
              <th className="border p-1 text-left w-20">Signature</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={13} className="border p-3 text-center text-muted-foreground">
                  Aucune livraison
                </td>
              </tr>
            ) : (
              lignes.map((l, i) => (
                <tr key={l.livraison_id}>
                  <td className="border p-1 text-center">{i + 1}</td>
                  <td className="border p-1 font-mono">
                    {l.commande_reference ?? "—"}
                    {l.facture_reference ? (
                      <div className="text-xs text-muted-foreground">{l.facture_reference}</div>
                    ) : null}
                  </td>
                  <td className="border p-1">{l.client_nom ?? "—"}</td>
                  <td className="border p-1">
                    {l.contact ?? "—"}
                    {l.telephone ? (
                      <div className="text-xs text-muted-foreground">{l.telephone}</div>
                    ) : null}
                  </td>
                  <td className="border p-1">{l.adresse ?? "—"}</td>
                  <td className="border p-1">
                    {[l.ville_livraison, l.commune].filter(Boolean).join(" · ") || "—"}
                    {l.gare_nom ? (
                      <div className="text-xs">Gare : {l.gare_nom}</div>
                    ) : null}
                  </td>
                  <td className="border p-1 text-right">{l.nb_cartons || 0}</td>
                  <td className="border p-1 text-right">{l.quantite_commandee}</td>
                  <td className="border p-1 text-right">{l.poids ? fmt(l.poids) : "—"}</td>
                  <td className="border p-1 text-right">{fmt(l.facture_montant ?? 0)}</td>
                  <td className="border p-1 text-right font-semibold">
                    {fmt(l.facture_reste ?? 0)}
                  </td>
                  <td className="border p-1">{STATUT_META[l.statut]?.label ?? l.statut}</td>
                  <td className="border p-1">&nbsp;</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-semibold">
              <td className="border p-1" colSpan={6}>
                Total ({nbLivraisons} livraison{nbLivraisons > 1 ? "s" : ""})
              </td>
              <td className="border p-1 text-right">{totalCartons}</td>
              <td className="border p-1 text-right">{totalQte}</td>
              <td className="border p-1 text-right">{totalPoids ? fmt(totalPoids) : "—"}</td>
              <td className="border p-1 text-right">{fmt(montantTransporte)}</td>
              <td className="border p-1 text-right">{fmt(montantRestant)}</td>
              <td className="border p-1" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>

        {/* Récapitulatif */}
        <div className="mt-4 border rounded p-3 bg-muted">
          <div className="text-xs font-semibold mb-2">
            Récapitulatif automatique
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <Field label="Clients" value={String(clientsSet.size)} />
            <Field label="Livraisons" value={String(nbLivraisons)} />
            <Field label="Commandes" value={String(commandesSet.size)} />
            <Field label="Factures" value={String(facturesSet.size)} />
            <Field label="Colis" value={String(totalColis)} />
            <Field label="Cartons" value={String(totalCartons)} />
            <Field label="Poids total" value={totalPoids ? `${fmt(totalPoids)}` : undefined} />
            <Field
              label="Distance"
              value={t.distance_km ? `${t.distance_km} km` : undefined}
            />
            <Field label="Montant transporté" value={`${fmt(montantTransporte)} FCFA`} />
            <Field label="Déjà encaissé" value={`${fmt(montantEncaisse)} FCFA`} />
            <Field label="À encaisser" value={`${fmt(montantRestant)} FCFA`} />
            <Field label="Livraisons réussies" value={String(nbReussies)} />
            <Field label="Anomalies" value={nbAnomalies ? String(nbAnomalies) : undefined} />
            <Field label="Retours" value={nbRetours ? String(nbRetours) : undefined} />
          </div>
        </div>

        {/* Détail colis */}
        {colis.length > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-semibold">Colis affectés ({colis.length})</h3>
              <span className="text-xs text-muted-foreground">
                Total cartons : <b>{totalCartonsColis}</b>
              </span>
            </div>
            <table className="w-full border-collapse text-xs table-zebra-orange table-print-borders">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-1 text-left">Réf. colis</th>
                  <th className="border p-1 text-left">Client</th>
                  <th className="border p-1 text-left">Destinataire</th>
                  <th className="border p-1 text-left">Ville / Commune / Quartier</th>
                  <th className="border p-1 text-left">Préparateur</th>
                  <th className="border p-1 text-left">Livreur</th>
                  <th className="border p-1 text-right">Cart.</th>
                  <th className="border p-1 text-right">Poids</th>
                  <th className="border p-1 text-left w-20">Émargement</th>
                </tr>
              </thead>
              <tbody>
                {colis.map((c) => (
                  <tr key={c.colis_id}>
                    <td className="border p-1 font-mono">{c.reference ?? "—"}</td>
                    <td className="border p-1">{c.client_nom ?? "—"}</td>
                    <td className="border p-1">{c.destinataire ?? "—"}</td>
                    <td className="border p-1">
                      {[c.ville_livraison, c.commune, c.quartier].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="border p-1">{c.responsable_nom ?? "—"}</td>
                    <td className="border p-1">{c.livreur_nom ?? "—"}</td>
                    <td className="border p-1 text-right">1</td>
                    <td className="border p-1 text-right">{c.poids ? fmt(c.poids) : "—"}</td>
                    <td className="border p-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observations */}
        <div className="mt-4">
          <div className="text-xs font-semibold mb-1">
            Observations / Incidents
          </div>
          {t.notes && (
            <p className="whitespace-pre-wrap text-xs mb-2 border-l-2 border-border pl-2 italic">
              {t.notes}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="border rounded p-2 min-h-[50px]">
               Incident&nbsp;&nbsp;&nbsp; Produit manquant&nbsp;&nbsp;&nbsp; Produit cassé
              <br />
               Refus client&nbsp;&nbsp;&nbsp; Retour&nbsp;&nbsp;&nbsp; Paiement partiel
              <br />
               Paiement refusé
            </div>
            <div className="border rounded p-2 min-h-[50px]">
              <span className="italic">Autres remarques :</span>
            </div>
          </div>
        </div>

        {/* Signatures 5 blocs */}
        <div className="grid grid-cols-5 gap-2 mt-6 text-xs">
          {[
            "Resp. logistique",
            "Préparateur",
            "Chauffeur",
            "Contrôleur",
            "Client",
          ].map((label) => (
            <div key={label} className="border rounded p-2 min-h-[70px]">
              <div className="font-semibold text-xs text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-xs">Nom : ______________</div>
              <div className="mt-6 border-t pt-1 text-xs text-muted-foreground">
                Date / Heure : ____ / ____
              </div>
            </div>
          ))}
        </div>

        {/* Pied de page */}
        <div className="mt-6 pt-2 border-t text-xs text-muted-foreground flex justify-between">
          <div>
            <div>
              {COMPANY.nom} — {COMPANY.adresse}
            </div>
            <div>
              Tél : {COMPANY.telephones.join(" / ")} · {COMPANY.email}
            </div>
          </div>
          <div className="text-right">
            <div>
              Édité le {dateEdition} à {heureEdition}
            </div>
            <div>Par : {user?.email ?? "—"}</div>
            <div className="">Document généré automatiquement par ERP FABS-CI</div>
          </div>
        </div>
      </div>
    </div>
  );
}
