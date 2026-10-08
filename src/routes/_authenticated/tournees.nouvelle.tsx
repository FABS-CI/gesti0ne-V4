import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Navigation, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { invalidateColisage } from "@/lib/cache-invalidation";
import { finaliserTournee } from "@/lib/livraison-suivi/writes";
import { Stat } from "@/components/tournees/edit/parts";
import {
  type BLStatusRow,
  type ColisRow,
  type CommandeRow,
  type CostsState,
  type DepotRow,
  type TourneeFormState,
  type Vehicule,
  defaultRef,
  todayISO,
} from "@/components/tournees/create/types";
import { ColisPickerTable } from "@/components/tournees/create/ColisPickerTable";
import { NewTourneeInfoCard } from "@/components/tournees/create/NewTourneeInfoCard";
import { NewTourneeCoutsCard } from "@/components/tournees/create/NewTourneeCoutsCard";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const searchSchema = z.object({
  preselect: fallback(z.string(), "").default(""),
  colis: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/tournees/nouvelle")({
  validateSearch: zodValidator(searchSchema),
  component: NouvelleTourneePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function NouvelleTourneePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { preselect, colis: colisParam } = Route.useSearch();
  const [dateColis, setDateColis] = useState<string>("");
  const [clientFilter, setClientFilter] = useState("");
  const [representantFilter, setRepresentantFilter] = useState("");
  const [villeFilter, setVilleFilter] = useState("");

  const colisQ = useQuery({
    queryKey: ["colis-prets-non-affectes"],
    queryFn: async (): Promise<ColisRow[]> => {
      const { data, error } = await supabase
        .from("colis")
        .select(
          "colis_id,reference,bl_id,numero_carton,nb_cartons,commande_id,destinataire,ville_livraison,quartier,vehicule,livreur_nom,responsable_nom,transporteur,mode_acheminement,date_colisage",
        )
        .is("tournee_id", null)
        .order("date_colisage", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const colis = (data ?? []) as ColisRow[];
      const blIds = Array.from(new Set(colis.map((c) => c.bl_id).filter((v): v is string => !!v)));
      if (blIds.length === 0) return [];

      const { data: bls, error: blError } = await supabase
        .from("bons_livraison")
        .select("bl_id,statut,reference,commande_id")
        .in("bl_id", blIds)
        .eq("statut", "colisage_termine");
      if (blError) throw blError;

      const blMap = new Map<string, { commande_id: string | null; reference: string | null }>();
      for (const bl of (bls ?? []) as Array<{
        bl_id: string;
        commande_id: string | null;
        reference: string | null;
      }>) {
        blMap.set(bl.bl_id, { commande_id: bl.commande_id, reference: bl.reference });
      }
      // Enrich: use BL's commande_id as fallback when colis.commande_id is null,
      // and attach the BL reference (bl_reference) for display.
      return colis
        .filter((c) => !!c.bl_id && blMap.has(c.bl_id))
        .map((c) => {
          const bl = blMap.get(c.bl_id!)!;
          return {
            ...c,
            commande_id: c.commande_id ?? bl.commande_id ?? null,
            bl_reference: bl.reference ?? null,
          } as ColisRow;
        });
    },
  });


  useEffect(() => {
    const ch = supabase
      .channel("nouvelle-tournee-colis-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "colis" }, () => {
        qc.invalidateQueries({ queryKey: ["colis-prets-non-affectes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bons_livraison" }, () => {
        qc.invalidateQueries({ queryKey: ["colis-prets-non-affectes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournees" }, () => {
        qc.invalidateQueries({ queryKey: ["colis-prets-non-affectes"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const commandeIds = useMemo(
    () =>
      Array.from(
        new Set((colisQ.data ?? []).map((c) => c.commande_id).filter((v): v is string => !!v)),
      ),
    [colisQ.data],
  );
  const cmdQ = useQuery({
    queryKey: ["commandes-for-nouvelle-tournee", commandeIds],
    enabled: commandeIds.length > 0,
    queryFn: async (): Promise<CommandeRow[]> => {
      const { data, error } = await supabase
        .from("commandes")
        .select(
          "commande_id,reference,client_id,client_nom,representant_nom,commercial_nom,total_quantite,depot_id,ville",
        )
        .in("commande_id", commandeIds);
      if (error) throw error;
      return (data ?? []) as CommandeRow[];
    },
  });
  const clientByCmd = useMemo(() => {
    const m = new Map<string, CommandeRow>();
    for (const r of cmdQ.data ?? []) m.set(r.commande_id, r);
    return m;
  }, [cmdQ.data]);

  const depotIds = useMemo(
    () =>
      Array.from(
        new Set(
          (cmdQ.data ?? []).map((c) => c.depot_id).filter((v): v is string => !!v),
        ),
      ),
    [cmdQ.data],
  );
  const depotQ = useQuery({
    queryKey: ["depots-for-nouvelle-tournee", depotIds],
    enabled: depotIds.length > 0,
    queryFn: async (): Promise<DepotRow[]> => {
      const { data, error } = await supabase
        .from("depots")
        .select("depot_id,nom")
        .in("depot_id", depotIds);
      if (error) throw error;
      return (data ?? []) as DepotRow[];
    },
  });
  const depotById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of depotQ.data ?? []) if (d.nom) m.set(d.depot_id, d.nom);
    return m;
  }, [depotQ.data]);

  const vehQ = useQuery({
    queryKey: ["vehicules-list"],
    queryFn: async (): Promise<Vehicule[]> => {
      const { data, error } = await supabase
        .from("vehicules")
        .select("vehicule_id,immatriculation")
        .order("immatriculation");
      if (error) throw error;
      return (data ?? []) as Vehicule[];
    },
  });

  const depotsListQ = useQuery({
    queryKey: ["depots-all-for-tournee"],
    queryFn: async (): Promise<DepotRow[]> => {
      const { data, error } = await supabase
        .from("depots")
        .select("depot_id,nom")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as DepotRow[];
    },
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetApplied, setPresetApplied] = useState(false);

  useEffect(() => {
    if (presetApplied) return;
    const rows = colisQ.data;
    if (!rows) return;
    if (colisParam) {
      const wanted = new Set(
        colisParam
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
      );
      const match = rows.filter((r) => wanted.has(r.colis_id)).map((r) => r.colis_id);
      if (match.length) setSelected(new Set(match));
      setPresetApplied(true);
    } else {
      if (rows.length) setSelected(new Set(rows.map((r) => r.colis_id)));
      setPresetApplied(true);
    }
  }, [colisQ.data, preselect, colisParam, presetApplied]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const allIds = (colisQ.data ?? []).map((c) => c.colis_id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const cf = clientFilter.trim().toLowerCase();
    const rf = representantFilter.trim().toLowerCase();
    const vf = villeFilter.trim().toLowerCase();
    const all = colisQ.data ?? [];
    return all.filter((c) => {
      const cmd = c.commande_id ? clientByCmd.get(c.commande_id) : undefined;
      const cli = cmd?.client_nom ?? "";
      const rep = (cmd?.representant_nom ?? cmd?.commercial_nom ?? "").toLowerCase();
      const ville = (c.ville_livraison ?? cmd?.ville ?? "").toLowerCase();
      if (dateColis && (c.date_colisage ?? "").slice(0, 10) !== dateColis) return false;
      if (cf && !cli.toLowerCase().includes(cf) && !(cmd?.client_id ?? "").toLowerCase().includes(cf))
        return false;
      if (rf && !rep.includes(rf)) return false;
      if (vf && !ville.includes(vf)) return false;
      if (!f) return true;
      return (
        (c.reference ?? "").toLowerCase().includes(f) ||
        (c.destinataire ?? "").toLowerCase().includes(f) ||
        ville.includes(f) ||
        (c.livreur_nom ?? "").toLowerCase().includes(f) ||
        rep.includes(f) ||
        cli.toLowerCase().includes(f)
      );
    });
  }, [colisQ.data, clientByCmd, filter, clientFilter, representantFilter, villeFilter, dateColis]);

  const selectedRows = useMemo(
    () => (colisQ.data ?? []).filter((c) => selected.has(c.colis_id)),
    [colisQ.data, selected],
  );
  const totals = useMemo(() => {
    // Chaque ligne de la table `colis` = 1 carton (numero_carton).
    // Un « colis » (envoi/BL) peut regrouper plusieurs cartons ⇒ compte les BL uniques.
    const nb_cartons = selectedRows.reduce(
      (s, r) => s + Math.max(1, Number(r.numero_carton ? 1 : r.nb_cartons ?? 1)),
      0,
    );
    const blIds = new Set<string>();
    for (const r of selectedRows) if (r.bl_id) blIds.add(r.bl_id);
    const nb_colis = blIds.size || selectedRows.length;
    const clientIds = new Set<string>();
    for (const r of selectedRows) {
      if (!r.commande_id) continue;
      const cid = clientByCmd.get(r.commande_id)?.client_id;
      if (cid) clientIds.add(cid);
    }
    return { nb_colis, nb_cartons, nb_clients: clientIds.size };
  }, [selectedRows, clientByCmd]);


  const [form, setForm] = useState<TourneeFormState>({
    reference: defaultRef(),
    date_tournee: todayISO(),
    heure_depart: "08:00",
    depot_depart_id: "",
    responsable_nom: "",
    chauffeur_nom: "",
    vehicule_id: "",
    statut: "preparee",
    type_tournee: "livraison",
    notes: "",
  });
  const [costs, setCosts] = useState<CostsState>({
    cout_carburant: 0,
    cout_peages: 0,
    cout_repas: 0,
    cout_livraison: 0,
    cout_expeditions: 0,
    cout_manutentions: 0,
    cout_autres: 0,
  });
  const coutTotal = useMemo(
    () => Object.values(costs).reduce((s, v) => s + (Number(v) || 0), 0),
    [costs],
  );

  useEffect(() => {
    const rowsAll = colisQ.data ?? [];
    if (!rowsAll.length) return;
    const mode = (k: keyof ColisRow) => {
      const counts = new Map<string, number>();
      for (const r of rowsAll) {
        const v = String(r[k] ?? "").trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best = "";
      let bestN = 0;
      for (const [k2, n] of counts)
        if (n > bestN) {
          best = k2;
          bestN = n;
        }
      return best;
    };
    setForm((f) => ({
      ...f,
      chauffeur_nom: f.chauffeur_nom || mode("livreur_nom"),
      responsable_nom: f.responsable_nom || mode("responsable_nom"),
    }));
  }, [colisQ.data]);

  useEffect(() => {
    if (form.vehicule_id) return;
    const vehs = vehQ.data ?? [];
    const rowsAll = colisQ.data ?? [];
    if (!vehs.length || !rowsAll.length) return;
    const counts = new Map<string, number>();
    for (const r of rowsAll) {
      const v = (r.vehicule ?? "").trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let bestImmat = "";
    let bestN = 0;
    for (const [k, n] of counts)
      if (n > bestN) {
        bestImmat = k;
        bestN = n;
      }
    if (!bestImmat) return;
    const match = vehs.find(
      (v) => (v.immatriculation ?? "").toLowerCase() === bestImmat.toLowerCase(),
    );
    if (match) setForm((f) => ({ ...f, vehicule_id: match.immatriculation ?? match.vehicule_id }));
  }, [vehQ.data, colisQ.data, form.vehicule_id]);

  const [saving, setSaving] = useState(false);
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.reference.trim()) missing.push("Référence");
    if (!form.chauffeur_nom.trim()) missing.push("Chauffeur");
    if (!form.date_tournee) missing.push("Date de départ");
    if (!form.heure_depart) missing.push("Heure de départ");
    if (!form.depot_depart_id) missing.push("Dépôt de départ");
    if (selected.size === 0) missing.push("Au moins un colis");
    return missing;
  }, [form, selected.size]);
  const canSave = missingFields.length === 0 && !saving;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const vehInput = form.vehicule_id.trim();
      const vehs = vehQ.data ?? [];
      const matchedVeh = vehInput
        ? vehs.find(
            (v) =>
              v.vehicule_id === vehInput ||
              (v.immatriculation ?? "").toLowerCase() === vehInput.toLowerCase(),
          )
        : null;
      const notesFinal =
        vehInput && !matchedVeh
          ? [`Véhicule: ${vehInput}`, form.notes].filter(Boolean).join("\n")
          : form.notes || null;
      const payload: Record<string, unknown> = {
        reference: form.reference.trim(),
        date_tournee: form.date_tournee,
        heure_depart: form.heure_depart,
        depot_depart_id: form.depot_depart_id,
        responsable_nom: form.responsable_nom || null,
        chauffeur_nom: form.chauffeur_nom || null,
        vehicule_id: matchedVeh ? matchedVeh.vehicule_id : null,
        statut: "preparee",
        type_tournee: form.type_tournee,
        notes: notesFinal,
        nb_colis: totals.nb_colis,
        nb_cartons: totals.nb_cartons,
        nb_clients: totals.nb_clients,
        ...costs,
      };
      const { data: created, error } = await supabase
        .from("tournees")
        .insert(payload as never)
        .select("tournee_id")
        .single();
      if (error) throw error;
      const tourneeId = (created as { tournee_id: string }).tournee_id;

      const ids = Array.from(selected);
      const { error: upErr } = await supabase.rpc("affecter_colis_tournee" as never, {
        _tournee_id: tourneeId,
        _colis_ids: ids,
      } as never);
      if (upErr) throw upErr;

      await finaliserTournee(tourneeId);

      toast.success("Tournée validée", {
        description: `${totals.nb_colis} colis affectés à ${form.reference}. Le suivi de livraison a été ouvert.`,
      });
      qc.invalidateQueries({ queryKey: ["tournees"] });
      invalidateColisage(qc);
      qc.invalidateQueries({ queryKey: ["colis-prets-non-affectes"] });
      qc.invalidateQueries({ queryKey: ["livsuivi"] });
      navigate({ to: "/tournees" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cause non précisée par le serveur. Réessayez dans un instant";
      toast.error("Impossible de créer la tournée", { description: msg });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const loading = colisQ.isLoading || vehQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tournees" })}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <div>
              <h1 className="ds-page-title">Nouvelle tournée</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez les colis prêts non affectés à charger dans la tournée.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSave}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Valider la tournée
          </Button>
          {missingFields.length > 0 && !saving && (
            <p className="text-xs text-destructive text-right max-w-xs">
              À compléter : {missingFields.join(", ")}.
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création de cette tournée ?</AlertDialogTitle>
            <AlertDialogDescription>
              Après validation, les {totals.nb_colis} colis sélectionnés seront affectés à la
              tournée <strong>{form.reference}</strong> et deviendront disponibles dans le module
              Suivi de livraison. Cette opération est définitive : un colis affecté ne peut plus
              être déplacé vers une autre tournée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Validation…
                </>
              ) : (
                "Confirmer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">
                Colis prêts non affectés
                <Badge variant="secondary" className="ml-2">
                  {rows.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filtrer…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-8 w-56"
                />
                <Button size="sm" variant="outline" onClick={toggleAll} disabled={!rows.length}>
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
            </div>
            <div className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input
                  placeholder="Client (nom ou code)"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="h-8"
                />
                <Input
                  placeholder="Représentant"
                  value={representantFilter}
                  onChange={(e) => setRepresentantFilter(e.target.value)}
                  className="h-8"
                />
                <Input
                  placeholder="Ville"
                  value={villeFilter}
                  onChange={(e) => setVilleFilter(e.target.value)}
                  className="h-8"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={dateColis}
                    onChange={(e) => setDateColis(e.target.value)}
                    className="h-8"
                    title="Filtre date (optionnel)"
                  />
                  {dateColis && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setDateColis("")}
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tous les colis dont le colisage est terminé et non affectés à une tournée sont
                affichés en temps réel. La date est un filtre optionnel.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ColisPickerTable
              rows={rows}
              loading={loading}
              selected={selected}
              toggle={toggle}
              clientByCmd={clientByCmd}
              depotById={depotById}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Récapitulatif temps réel</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Colis" value={totals.nb_colis} />
              <Stat label="Cartons" value={totals.nb_cartons} />
              <Stat label="Clients" value={totals.nb_clients} />
            </CardContent>
          </Card>

          <NewTourneeInfoCard
            form={form}
            setForm={setForm}
            depots={depotsListQ.data ?? []}
            vehicules={vehQ.data ?? []}
          />
          <NewTourneeCoutsCard costs={costs} setCosts={setCosts} coutTotal={coutTotal} />
        </div>
      </div>
    </div>
  );
}
