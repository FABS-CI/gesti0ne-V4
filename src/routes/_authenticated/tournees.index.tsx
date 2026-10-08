import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, Navigation, Receipt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BACKOFF_INITIAL, nextBackoffDelay } from "@/lib/realtime-backoff";
import { viewCached } from "@/lib/pdf/actions";
import { invalidatePdfByPrefix } from "@/lib/pdf/pdfCache";
import { generateBonTourneePDF, generateBonSortiePDF } from "@/lib/pdf/tourneePdf";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function computeTourneeDefaults(): Promise<Record<string, unknown>> {
  const today = todayISO();
  const { data, error } = await supabase
    .from("colis")
    .select(
      "colis_id, nb_cartons, commande_id, vehicule, livreur_nom, transporteur, responsable_nom",
    )
    .eq("date_colisage", today);
  if (error || !data) return {};
  const nb_colis = data.length;
  const nb_cartons = data.reduce(
    (s, r) => s + Number((r as { nb_cartons: number | null }).nb_cartons ?? 0),
    0,
  );
  const commandeIds = new Set(
    data
      .map((r) => (r as { commande_id: string | null }).commande_id)
      .filter((v): v is string => !!v),
  );
  let nb_clients = commandeIds.size;
  if (commandeIds.size > 0) {
    const { data: cmds } = await supabase
      .from("commandes")
      .select("client_id")
      .in("commande_id", Array.from(commandeIds));
    if (cmds) {
      const clientIds = new Set(
        cmds.map((c) => (c as { client_id: string | null }).client_id).filter(Boolean),
      );
      if (clientIds.size > 0) nb_clients = clientIds.size;
    }
  }

  // Pick most frequent non-empty value for each text field
  const mode = (key: "vehicule" | "livreur_nom" | "transporteur" | "responsable_nom") => {
    const counts = new Map<string, number>();
    for (const r of data as Array<Record<string, string | null>>) {
      const v = (r[key] ?? "").trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [k, n] of counts) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best;
  };

  const vehiculeImmat = mode("vehicule");
  const chauffeur_nom = mode("livreur_nom");
  const responsable_nom = mode("responsable_nom");
  // transporteur non stocké sur tournees (colonnes fixes) → injecté dans notes
  const transporteur = mode("transporteur");

  // Résolution véhicule (texte immatriculation → vehicule_id)
  let vehicule_id: string | undefined;
  if (vehiculeImmat) {
    const { data: veh } = await supabase
      .from("vehicules")
      .select("vehicule_id")
      .ilike("immatriculation", vehiculeImmat)
      .maybeSingle();
    if (veh) vehicule_id = (veh as { vehicule_id: string }).vehicule_id;
  }

  const defaults: Record<string, unknown> = {
    date_tournee: today,
    nb_colis,
    nb_cartons,
    nb_clients,
  };
  const sources: Record<string, string> = {
    date_tournee: "Aujourd'hui",
    nb_colis: "Colisage du jour",
    nb_cartons: "Colisage du jour",
    nb_clients: "Colisage du jour (clients uniques)",
  };
  if (vehicule_id) {
    defaults.vehicule_id = vehicule_id;
    sources.vehicule_id = `Colisage du jour → ${vehiculeImmat}`;
  }
  if (chauffeur_nom) {
    defaults.chauffeur_nom = chauffeur_nom;
    sources.chauffeur_nom = "Colisage du jour (livreur le plus fréquent)";
  }
  if (responsable_nom) {
    defaults.responsable_nom = responsable_nom;
    sources.responsable_nom = "Colisage du jour (responsable le plus fréquent)";
  }
  if (transporteur) {
    defaults.notes = `Transporteur (colisage du jour) : ${transporteur}`;
    sources.notes = `Transporteur repris du colisage : ${transporteur}`;
  }
  defaults.__sources = sources;
  return defaults;
}

const statuts = [
  { value: "preparee", label: "Préparée", color: "#94A3B8" },
  { value: "en_cours", label: "En cours", color: "#3B82F6" },
  { value: "terminee", label: "Terminée", color: "#10B981" },
  { value: "annulee", label: "Annulée", color: "#EF4444" },
];

function buildConfig(onCloturer: (tourneeId: string, ref: string) => void): ResourceConfig {
  return {
    table: "tournees",
    idField: "tournee_id",
    title: "Tournées logistiques",
    subtitle: "Journées de travail : véhicules, chauffeurs, livraisons, expéditions et coûts",
    icon: Navigation,
    newLabel: "Nouvelle tournée",
    newHref: "/tournees/nouvelle",
    editHref: (row) => `/tournees/${(row as { tournee_id: string }).tournee_id}`,
    entityLabel: "la tournée",
    csvName: "tournees",
    searchFields: ["reference", "responsable_nom", "chauffeur_nom"],
    statusFilter: { field: "statut", options: statuts },
    computeNewDefaults: computeTourneeDefaults,
    rowActions: [
      {
        label: "Bon de tournée",
        icon: ClipboardList,
        onClick: (row) => {
          const id = row.tournee_id as string;
          viewCached(`bon-tournee-${id}`, () => generateBonTourneePDF(id), {
            title: `Bon de tournée · ${row.reference ?? ""}`,
            filename: `bon-tournee-${row.reference ?? id}.pdf`,
          });
        },
      },
      {
        label: "Bon de sortie",
        icon: Receipt,
        onClick: (row) => {
          const id = row.tournee_id as string;
          viewCached(`bon-sortie-${id}`, () => generateBonSortiePDF(id), {
            title: `Bon de sortie · ${row.reference ?? ""}`,
            filename: `bon-sortie-${row.reference ?? id}.pdf`,
          });
        },
      },
      {
        label: "Valider",
        icon: CheckCircle2,
        render: (row) => {
          if ((row as { statut?: string }).statut !== "en_cours") return null;
          const id = (row as { tournee_id: string }).tournee_id;
          const ref = ((row as { reference?: string }).reference ?? "") as string;
          return (
            <Button aria-label="Valider la tournée"
              variant="ghost"
              size="icon"
              title="Valider la tournée"
              onClick={() => onCloturer(id, ref)}
            >
              <CheckCircle2 className="h-4 w-4 text-success" />
            </Button>
          );
        },
      },
    ],
    columns: [
      { name: "reference", label: "Référence", type: "mono" },
      { name: "date_tournee", label: "Date", type: "date" },
      { name: "responsable_nom", label: "Responsable" },
      { name: "chauffeur_nom", label: "Chauffeur" },
      { name: "nb_colis", label: "Colis", align: "right" },
      { name: "nb_cartons", label: "Cartons", align: "right" },
      { name: "cout_total", label: "Coût total", type: "money", align: "right" },
      { name: "statut", label: "Statut", type: "badge", options: statuts },
    ],
    fields: [
      { name: "reference", label: "Référence", required: true },
      { name: "date_tournee", label: "Date", type: "date" },
      { name: "responsable_nom", label: "Responsable logistique" },
      { name: "chauffeur_nom", label: "Chauffeur" },
      {
        name: "vehicule_id",
        label: "Véhicule",
        type: "lookup",
        lookup: {
          table: "vehicules",
          valueField: "vehicule_id",
          labelField: "immatriculation",
          orderBy: "immatriculation",
        },
      },
      { name: "statut", label: "Statut", type: "select", options: statuts, default: "preparee" },
      {
        name: "type_tournee",
        label: "Type de tournée",
        type: "select",
        options: [
          { value: "livraison", label: "Livraison" },
          { value: "expedition", label: "Expédition" },
          { value: "mixte", label: "Mixte" },
        ],
        default: "livraison",
      },
      { name: "nb_colis", label: "Nombre de colis", type: "number" },
      { name: "nb_cartons", label: "Nombre de cartons", type: "number" },
      { name: "nb_clients", label: "Nombre de clients", type: "number" },
      { name: "cout_carburant", label: "Carburant (FCFA)", type: "money" },
      { name: "cout_peages", label: "Péages (FCFA)", type: "money" },
      { name: "cout_repas", label: "Repas (FCFA)", type: "money" },
      { name: "cout_livraison", label: "Frais de livraison (FCFA)", type: "money" },
      { name: "cout_expeditions", label: "Expéditions (FCFA)", type: "money" },
      { name: "cout_manutentions", label: "Manutentions (FCFA)", type: "money" },
      { name: "cout_autres", label: "Autres frais (FCFA)", type: "money" },
      { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
    ],
  };
}

export const Route = createFileRoute("/_authenticated/tournees/")({
  component: TourneesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function TourneesPage() {
  const qc = useQueryClient();
  // Synchronisation silencieuse : Realtime + fallback polling avec backoff.
  // Aucun bandeau, aucun toast, aucun bouton "Rafraîchir" — l'UI reste fluide.
  const [rtLive, setRtLive] = useState(false);
  const handleCloturer = async (tourneeId: string, ref: string) => {
    const tid = toast.loading(`Validation de la tournée ${ref}…`);
    try {
      const { error } = await supabase.rpc("cloturer_tournee" as never, {
        _tournee_id: tourneeId,
      } as never);
      if (error) throw new Error(error.message);
      invalidatePdfByPrefix(`bon-tournee-${tourneeId}`);
      toast.success(`Tournée ${ref} validée`, {
        id: tid,
        description: "Suivi des livraisons créé — le chauffeur peut partir.",
      });
      qc.invalidateQueries({ queryKey: ["tournees"] });
      qc.invalidateQueries({ queryKey: ["livsuivi"] });
      qc.invalidateQueries({ queryKey: ["livsuivi-commandes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-logistique"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cause non précisée par le serveur. Réessayez dans un instant";
      toast.error("Impossible de valider", { id: tid, description: msg });
    }
  };
  const config = buildConfig(handleCloturer);

  // Fallback polling silencieux (backoff exponentiel) tant que Realtime n'est
  // pas connecté. Reset immédiat dès que le canal passe à `live`.
  const delayRef = useRef(BACKOFF_INITIAL);
  useEffect(() => {
    if (rtLive) {
      delayRef.current = BACKOFF_INITIAL;
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      qc.invalidateQueries({ queryKey: ["tournees"] });
      delayRef.current = nextBackoffDelay(delayRef.current);
      timer = setTimeout(tick, delayRef.current);
    };
    timer = setTimeout(tick, delayRef.current);
    return () => clearTimeout(timer);
  }, [rtLive, qc]);

  // Realtime silencieux : rafraîchit la liste sur toute mutation `tournees`
  // et sur les changements d'affectation `colis.tournee_id` (charge/livraison).
  useEffect(() => {
    const ch = supabase
      .channel("tournees-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournees" }, () =>
        qc.invalidateQueries({ queryKey: ["tournees"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "colis" }, () =>
        qc.invalidateQueries({ queryKey: ["tournees"] }),
      )
      .subscribe((status) => {
        setRtLive(status === "SUBSCRIBED");
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  return (
    <div className="space-y-2">
      <ResourceManager config={config} />
    </div>
  );
}
