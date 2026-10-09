import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RotateCcw, Play, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { askConfirm } from "@/components/common/GlobalConfirm";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { authRouteHead } from "@/lib/route-head";
import { friendlyError } from "@/lib/friendly-error";
import { formatDateTime, formatFCFA } from "@/lib/format";
import {
  STATUT_LABEL,
  calculerRenommage,
  compterStatuts,
  type RenommageLigne,
  type RenommageSource,
  type RenommageStatut,
} from "@/lib/renommage-clients";

export const Route = createFileRoute("/_authenticated/admin/renommage-clients")({
  head: () => authRouteHead("Renommage des clients"),
  component: RenommagePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Controle = { nb_clients: number; nb_debiteurs: number; total_impaye: number };
const BATCH = 200;

async function chargerClients(): Promise<RenommageSource[]> {
  const out: RenommageSource[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("clients")
      .select("client_id,reference,nom,ancien_nom,representant,type_renommage")
      .order("reference")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data as RenommageSource[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const STATUT_VARIANT: Record<RenommageStatut, "default" | "secondary" | "outline" | "destructive"> = {
  renomme: "default",
  doublon: "secondary",
  manuel: "destructive",
  verifier: "outline",
  non_concerne: "outline",
};

function RenommagePage() {
  const qc = useQueryClient();
  const [filtre, setFiltre] = useState<RenommageStatut | "all">("all");
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newExcl, setNewExcl] = useState("");
  const [resultat, setResultat] = useState<null | (Controle & { avant: Controle })>(null);

  const clientsQ = useQuery({ queryKey: ["renommage", "clients"], queryFn: chargerClients });
  const exclQ = useQuery({
    queryKey: ["renommage", "exclusions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_renommage_exclusions").select("reference").order("reference");
      if (error) throw error;
      return data.map((d) => d.reference);
    },
  });
  const controleQ = useQuery({
    queryKey: ["renommage", "controle"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("renommage_clients_controle");
      if (error) throw error;
      return data as unknown as Controle;
    },
  });
  const lotsQ = useQuery({
    queryKey: ["renommage", "lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_renommage_lots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
  const [lotOuvert, setLotOuvert] = useState<string | null>(null);
  const journalQ = useQuery({
    queryKey: ["renommage", "journal", lotOuvert],
    enabled: !!lotOuvert,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_renommage_journal")
        .select("reference,ancien_nom,nouveau_nom,created_at")
        .eq("lot_id", lotOuvert!)
        .order("reference");
      if (error) throw error;
      return data;
    },
  });

  const lignes = useMemo(
    () => (clientsQ.data ? calculerRenommage(clientsQ.data, exclQ.data ?? []) : []),
    [clientsQ.data, exclQ.data],
  );
  const compteurs = compterStatuts(lignes);
  const nomFinal = (l: RenommageLigne) => (edits[l.client_id]?.trim() || l.nouveau_nom || "").toUpperCase();
  const aAppliquer = lignes.filter((l) => {
    const n = nomFinal(l);
    if (!n || n === l.nom_actuel.toUpperCase()) return false;
    return l.statut === "renomme" || l.statut === "doublon" || !!edits[l.client_id]?.trim();
  });

  const visibles = lignes.filter((l) => {
    if (filtre !== "all" && l.statut !== filtre) return false;
    if (!q) return true;
    const s = q.toUpperCase();
    return [l.reference, l.ancien_nom, l.nom_actuel, l.representant, l.nouveau_nom ?? ""].some((v) =>
      v.toUpperCase().includes(s),
    );
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["renommage"] });

  const appliquer = useMutation({
    mutationFn: async () => {
      const { data: lot, error } = await supabase.rpc("renommage_clients_ouvrir_lot");
      if (error) throw error;
      const items = aAppliquer.map((l) => ({ client_id: l.client_id, nouveau_nom: nomFinal(l), type: l.type ?? "" }));
      for (let i = 0; i < items.length; i += BATCH) {
        const { error: e } = await supabase.rpc("renommage_clients_appliquer_lot", {
          _lot_id: lot as string,
          _items: items.slice(i, i + BATCH),
        });
        if (e) throw e;
      }
      const { data: res, error: e2 } = await supabase.rpc("renommage_clients_cloturer_lot", { _lot_id: lot as string });
      if (e2) throw e2;
      const r = res as Record<string, number>;
      return {
        nb_clients: r.nb_clients, nb_debiteurs: r.nb_debiteurs, total_impaye: Number(r.total_impaye),
        avant: { nb_clients: r.nb_clients_avant, nb_debiteurs: r.nb_debiteurs_avant, total_impaye: Number(r.total_impaye_avant) },
      };
    },
    onSuccess: (r) => {
      setResultat(r);
      setEdits({});
      toast.success("Renommage appliqué");
      refresh();
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Renommage impossible")),
  });

  const annuler = useMutation({
    mutationFn: async (lotId: string) => {
      const { data, error } = await supabase.rpc("renommage_clients_annuler_lot", { _lot_id: lotId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} nom(s) restauré(s)`);
      setResultat(null);
      refresh();
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Annulation impossible")),
  });

  async function ajouterExclusion() {
    const ref = newExcl.trim().toUpperCase();
    if (!ref) return;
    const { error } = await supabase.from("client_renommage_exclusions").insert({ reference: ref });
    if (error) return toast.error(friendlyError(error, "Ajout impossible"));
    setNewExcl("");
    refresh();
  }
  async function retirerExclusion(ref: string) {
    const { error } = await supabase.from("client_renommage_exclusions").delete().eq("reference", ref);
    if (error) return toast.error(friendlyError(error, "Retrait impossible"));
    refresh();
  }

  async function exporter() {
    const XLSX = await import("xlsx");
    const rows = visibles.map((l) => ({
      Référence: l.reference,
      "Ancien nom": l.ancien_nom,
      Représentant: l.representant,
      "Nouveau nom": nomFinal(l) || "",
      Statut: STATUT_LABEL[l.statut],
      Raison: l.raison,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Renommage");
    XLSX.writeFile(wb, "renommage-clients.xlsx");
  }

  async function lancer() {
    const ok = await askConfirm({
      title: `Appliquer le renommage de ${aAppliquer.length} client(s) ?`,
      description:
        "Les anciens noms sont sauvegardés et le renommage pourra être annulé en un clic. Les références, soldes et documents restent liés aux mêmes clients.",
      confirmLabel: "Appliquer le renommage",
    });
    if (ok) appliquer.mutate();
  }

  const ctl = controleQ.data;
  const cartes: Array<[string, number, RenommageStatut | "all"]> = [
    ["Total clients", lignes.length, "all"],
    ["Renommés", compteurs.renomme, "renomme"],
    ["Doublons résolus", compteurs.doublon, "doublon"],
    ["À traiter manuellement", compteurs.manuel, "manuel"],
    ["À vérifier", compteurs.verifier, "verifier"],
    ["Non concernés", compteurs.non_concerne, "non_concerne"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title">Renommage des clients</h1>
        <p className="text-sm text-muted-foreground">
          Les noms d'écoles et d'institutions deviennent « LIBRAIRIE » ou « PAPETERIE » suivi du représentant.
          La référence, le solde et l'historique ne changent pas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartes.map(([label, n, s]) => (
          <button
            key={label}
            type="button"
            onClick={() => setFiltre(s)}
            className={`rounded-md border p-3 text-left ${filtre === s ? "border-primary bg-muted" : "bg-card"}`}
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold tabular-nums">{n}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contrôle</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <div>Clients : <b className="tabular-nums">{ctl?.nb_clients ?? "…"}</b></div>
          <div>Clients débiteurs : <b className="tabular-nums">{ctl?.nb_debiteurs ?? "…"}</b></div>
          <div>Total impayé : <b className="tabular-nums">{ctl ? formatFCFA(Number(ctl.total_impaye)) : "…"}</b></div>
          {resultat && (
            <div className="sm:col-span-3 rounded-md border p-3">
              <div className="font-medium mb-1">
                {resultat.nb_clients === resultat.avant.nb_clients &&
                resultat.nb_debiteurs === resultat.avant.nb_debiteurs &&
                resultat.total_impaye === resultat.avant.total_impaye
                  ? "Contrôle réussi : chiffres identiques avant et après."
                  : "Attention : les chiffres diffèrent entre avant et après."}
              </div>
              Avant : {resultat.avant.nb_clients} clients, {resultat.avant.nb_debiteurs} débiteurs,{" "}
              {formatFCFA(resultat.avant.total_impaye)} — Après : {resultat.nb_clients} clients,{" "}
              {resultat.nb_debiteurs} débiteurs, {formatFCFA(resultat.total_impaye)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Rechercher (référence, nom, représentant)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={exporter}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
        <Button onClick={lancer} disabled={!aAppliquer.length || appliquer.isPending}>
          <Play className="mr-2 h-4 w-4" />
          {appliquer.isPending ? "Application en cours…" : `Appliquer le renommage (${aAppliquer.length})`}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Ancien nom</TableHead>
                <TableHead>Représentant</TableHead>
                <TableHead>Nouveau nom</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsQ.isLoading && (
                <TableRow><TableCell colSpan={5}>Chargement…</TableCell></TableRow>
              )}
              {visibles.slice(0, 500).map((l) => (
                <TableRow key={l.client_id}>
                  <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                  <TableCell>
                    {l.ancien_nom}
                    {l.nom_actuel !== l.ancien_nom && (
                      <div className="text-xs text-muted-foreground">Actuel : {l.nom_actuel}</div>
                    )}
                  </TableCell>
                  <TableCell>{l.representant || "—"}</TableCell>
                  <TableCell className="min-w-56">
                    {l.statut === "non_concerne" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Input
                        aria-label={`Nouveau nom pour ${l.reference}`}
                        value={edits[l.client_id] ?? l.nouveau_nom ?? ""}
                        placeholder="Saisir le nom à la main"
                        onChange={(e) => setEdits((p) => ({ ...p, [l.client_id]: e.target.value }))}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUT_VARIANT[l.statut]}>{STATUT_LABEL[l.statut]}</Badge>
                    {l.raison && <div className="text-xs text-muted-foreground mt-1">{l.raison}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibles.length > 500 && (
            <p className="p-3 text-xs text-muted-foreground">
              500 lignes affichées sur {visibles.length} : affinez avec la recherche ou un filtre. L'export Excel contient tout.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Références à ne jamais renommer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Ex. CL-COL-118" value={newExcl} onChange={(e) => setNewExcl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterExclusion()} />
              <Button variant="outline" onClick={ajouterExclusion}><Plus className="mr-2 h-4 w-4" /> Ajouter</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(exclQ.data ?? []).map((r) => (
                <Badge key={r} variant="secondary" className="gap-1 font-mono">
                  {r}
                  <button type="button" aria-label={`Retirer ${r}`} onClick={() => retirerExclusion(r)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {!exclQ.data?.length && <span className="text-sm text-muted-foreground">Aucune exclusion.</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Journal des renommages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(lotsQ.data ?? []).map((lot) => (
              <div key={lot.lot_id} className="rounded-md border p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="text-left" onClick={() => setLotOuvert(lotOuvert === lot.lot_id ? null : lot.lot_id)}>
                    {formatDateTime(lot.created_at)} — {lot.created_by_email ?? "—"} — {lot.nb_renommes} client(s){" "}
                    <Badge variant="outline">{lot.statut === "annule" ? "Annulé" : lot.statut === "applique" ? "Appliqué" : "Incomplet"}</Badge>
                  </button>
                  {lot.statut !== "annule" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={annuler.isPending}
                      onClick={async () => {
                        if (await askConfirm({ title: "Annuler le renommage ?", description: "Tous les anciens noms de ce lot seront restaurés, sur les fiches et sur les documents.", destructive: true }))
                          annuler.mutate(lot.lot_id);
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Annuler le renommage
                    </Button>
                  )}
                </div>
                {lotOuvert === lot.lot_id && (
                  <div className="mt-2 max-h-64 overflow-auto text-xs">
                    {(journalQ.data ?? []).map((j) => (
                      <div key={j.reference + j.created_at} className="border-t py-1">
                        <span className="font-mono">{j.reference}</span> : {j.ancien_nom} → {j.nouveau_nom}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!lotsQ.data?.length && <p className="text-sm text-muted-foreground">Aucun renommage pour l'instant.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
