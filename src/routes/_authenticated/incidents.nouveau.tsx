import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { listDepots, getStockProduitDepot } from "@/lib/depots-api";
import type { Produit } from "@/lib/produits-api";
import { creerIncident, TYPES_INCIDENT } from "@/lib/incidents-api";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/incidents/nouveau")({
  component: NouvelIncidentPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type LigneUI = {
  produit_id: string | null;
  reference_produit: string;
  designation: string;
  quantite: number;
  stock_disponible: number | null;
};

const emptyLigne = (): LigneUI => ({
  produit_id: null,
  reference_produit: "",
  designation: "",
  quantite: 1,
  stock_disponible: null,
});

function NouvelIncidentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has, isLoading: rolesLoading } = usePermissions();
  const canManage = has("incidents.creer");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeIncident, setTypeIncident] = useState<string>("document_endommage");
  const [depotId, setDepotId] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [observations, setObservations] = useState("");
  const [lignes, setLignes] = useState<LigneUI[]>([emptyLigne()]);

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: () => listDepots(),
  });

  // Default to principal depot
  useEffect(() => {
    if (!depotId && depots.length > 0) {
      const principal = depots.find((d) => d.is_principal) ?? depots[0];
      setDepotId(principal.depot_id);
    }
  }, [depots, depotId]);

  // Refresh stocks when depot changes
  useEffect(() => {
    if (!depotId) return;
    let cancelled = false;
    (async () => {
      const refreshed = await Promise.all(
        lignes.map(async (l) => {
          if (!l.produit_id) return l;
          const s = await getStockProduitDepot(l.produit_id, depotId);
          return { ...l, stock_disponible: s };
        }),
      );
      if (!cancelled) setLignes(refreshed);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  const qteTotale = useMemo(() => lignes.reduce((s, l) => s + (l.quantite || 0), 0), [lignes]);

  const saveMutation = useMutation({
    mutationFn: () =>
      creerIncident({
        date_incident: date,
        type_incident: typeIncident,
        depot_id: depotId,
        motif: motif || null,
        observations: observations || null,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id!,
          reference_produit: l.reference_produit || null,
          designation: l.designation,
          quantite: l.quantite,
        })),
      }),
    onSuccess: () => {
      toast.success("Incident enregistré, stock mis à jour");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock_mouvements"] });
      navigate({ to: "/incidents" });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  function updateLigne(i: number, patch: Partial<LigneUI>) {
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onPickProduit(i: number, p: Produit | null) {
    if (!p) {
      updateLigne(i, {
        produit_id: null,
        reference_produit: "",
        designation: "",
        stock_disponible: null,
      });
      return;
    }
    const stock = depotId ? await getStockProduitDepot(p.produit_id, depotId) : 0;
    updateLigne(i, {
      produit_id: p.produit_id,
      reference_produit: p.reference,
      designation: p.titre,
      stock_disponible: stock,
    });
  }

  function validate(): string | null {
    if (!depotId) return "Sélectionnez un magasin / dépôt";
    if (!typeIncident) return "Sélectionnez un type d'incident";
    if (lignes.length === 0) return "Ajoutez au moins une ligne produit";
    for (const [i, l] of lignes.entries()) {
      if (!l.produit_id) return `Ligne ${i + 1} : sélectionnez un produit`;
      if (!l.quantite || l.quantite <= 0) return `Ligne ${i + 1} : quantité invalide`;
      if (l.stock_disponible != null && l.quantite > l.stock_disponible) {
        return `Ligne ${i + 1} : quantité (${l.quantite}) supérieure au stock disponible (${l.stock_disponible})`;
      }
    }
    return null;
  }

  function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    saveMutation.mutate();
  }

  if (!rolesLoading && !canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation de déclarer un incident.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/incidents">Retour</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <Button aria-label="Retour" asChild variant="ghost" size="icon">
          <Link to="/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <AlertTriangle className="h-6 w-6 text-warning" />
        <div>
          <h1 className="ds-page-title">Nouvel Incident de Stock</h1>
          <p className="text-sm text-muted-foreground">
            Déclaration d'une perte, détérioration ou autre sortie exceptionnelle
          </p>
        </div>
      </div>

      <section className="rounded-md border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">1. Informations générales</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Numéro</Label>
            <Input value="(généré automatiquement)" readOnly disabled />
          </div>
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Type d'incident *</Label>
            <Select value={typeIncident} onValueChange={setTypeIncident}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES_INCIDENT.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Magasin / Dépôt *</Label>
            <Select value={depotId} onValueChange={(v) => setDepotId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un dépôt" />
              </SelectTrigger>
              <SelectContent>
                {depots
                  .filter((d) => d.actif)
                  .map((d) => (
                    <SelectItem key={d.depot_id} value={d.depot_id}>
                      {d.nom}
                      {d.is_principal ? " — Principal" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Motif détaillé *</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              placeholder="Décrivez précisément ce qui s'est passé…"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Observations</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">2. Produits concernés</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLignes((arr) => [...arr, emptyLigne()])}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Produit</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead className="text-right">Stock dispo</TableHead>
              <TableHead className="text-right w-28">Quantité *</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l, i) => {
              const over = l.stock_disponible != null && l.quantite > l.stock_disponible;
              return (
                <TableRow key={i}>
                  <TableCell>
                    <ProductSearchSelect
                      value={l.produit_id}
                      onChange={(_id, p) => onPickProduit(i, p)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.reference_produit || "—"}</TableCell>
                  <TableCell className="text-right">
                    {l.stock_disponible == null ? "—" : l.stock_disponible}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) || 0 })}
                      className={`text-right h-9 ${over ? "text-destructive border-destructive" : ""}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setLignes((arr) =>
                          arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i),
                        )
                      }
                      disabled={lignes.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex justify-end gap-6 border-t pt-4 text-sm">
          <span className="text-muted-foreground">
            Quantité totale : <span className="font-semibold">{qteTotale}</span>
          </span>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link to="/incidents">Annuler</Link>
        </Button>
        <Button onClick={submit} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer l'incident"}
        </Button>
      </div>
    </div>
  );
}
