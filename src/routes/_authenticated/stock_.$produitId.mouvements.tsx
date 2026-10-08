import { formatDate, formatTime } from "@/lib/format";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sliders } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  listDepots,
  getStocksParDepot,
  getStockProduitDepot,
  ajusterStockDepot,
} from "@/lib/depots-api";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { invalidateStock } from "@/lib/cache-invalidation";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/stock_/$produitId/mouvements")({
  component: AjustementPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function etatStock(stock: number, seuil: number) {
  if (stock <= 0) return { label: "Rupture", color: "#EF4444" };
  if (seuil > 0 && stock <= seuil) return { label: "Seuil atteint", color: "#F97316" };
  if (seuil > 0 && stock <= seuil * 1.5) return { label: "Stock faible", color: "#EAB308" };
  return { label: "Stock normal", color: "#10B981" };
}

function AjustementPage() {
  const { produitId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { has, isLoading: rolesLoading } = usePermissions();
  const autorise = has("stock.creer_mouvement");

  const [depotId, setDepotId] = useState<string>("");
  const [type, setType] = useState<"entree" | "sortie">("entree");
  const [quantite, setQuantite] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const now = useMemo(() => new Date(), []);

  const { data: produit } = useQuery({
    queryKey: ["produit", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_produits")
        .select("*")
        .eq("produit_id", produitId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: depots = [] } = useQuery({ queryKey: ["depots"], queryFn: listDepots });
  const { data: stocksDepots = [] } = useQuery({
    queryKey: ["stocks-depots", produitId],
    queryFn: () => getStocksParDepot(produitId),
  });

  const { data: stockDepot = 0, refetch: refetchStockDepot } = useQuery({
    queryKey: ["stock-produit-depot", produitId, depotId],
    queryFn: () => getStockProduitDepot(produitId, depotId),
    enabled: !!depotId,
  });

  useEffect(() => {
    if (!depotId && depots.length) {
      const principal = depots.find((d) => d.is_principal);
      setDepotId(principal?.depot_id ?? depots[0].depot_id);
    }
  }, [depots, depotId]);

  const stockTotal = produit?.stock ?? 0;
  const seuil = produit?.seuil_alerte ?? 0;
  const etat = etatStock(stockTotal, seuil);

  const qty = parseInt(quantite, 10);
  const qtyValide = Number.isFinite(qty) && qty > 0;
  const nouvelleQte =
    type === "entree"
      ? (stockDepot ?? 0) + (qtyValide ? qty : 0)
      : (stockDepot ?? 0) - (qtyValide ? qty : 0);
  const stockNegatif = nouvelleQte < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!autorise) {
      toast.error("Vous n'avez pas l'autorisation d'ajuster le stock");
      return;
    }
    if (!depotId) return toast.error("Le dépôt est obligatoire");
    if (!qtyValide) return toast.error("Quantité invalide");
    if (!motif.trim()) return toast.error("Le motif est obligatoire");
    if (stockNegatif) return toast.error("Stock négatif interdit");

    setSubmitting(true);
    try {
      await ajusterStockDepot({
        produit_id: produitId,
        depot_id: depotId,
        nouvelle_quantite: nouvelleQte,
        motif: `${motif}${observation ? ` — ${observation}` : ""}`,
      });
      toast.success("Ajustement enregistré");
      await Promise.all([refetchStockDepot()]);
      invalidateStock(qc);
      navigate({ to: "/stock" });
    } catch (err) {
      toast.error(friendlyError(err, "Erreur lors de l'ajustement"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/stock">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour au stock
          </Link>
        </Button>
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Sliders className="h-6 w-6 text-[#10B981]" /> Ajustement manuel de stock
          </h1>
          <p className="text-sm text-muted-foreground">
            {produit?.reference} · {produit?.titre}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations produit</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-muted-foreground">Référence</div>
            <div className="font-medium">{produit?.reference ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Produit</div>
            <div className="font-medium">{produit?.titre ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Catégorie</div>
            <div className="font-medium">{produit?.categorie ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Niveau</div>
            <div className="font-medium">{produit?.niveau ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stock total</div>
            <div className="text-xl font-bold">{stockTotal}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Seuil minimum</div>
            <div className="text-xl font-bold">{seuil}</div>
          </div>
          <div>
            <div className="text-muted-foreground">État</div>
            <Badge style={{ background: etat.color, color: "#fff" }}>{etat.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {stocksDepots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stocks par dépôt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stocksDepots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDepotId(s.depot_id)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${depotId === s.depot_id ? "border-[#10B981] bg-[#10B981]/10" : ""}`}
                >
                  <span>{s.depots?.nom ?? "—"}</span>
                  <span className="font-bold">{s.quantite}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input readOnly value={formatDate(now)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heure</Label>
                <Input
                  readOnly
                  value={formatTime(now)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Utilisateur</Label>
                <Input readOnly value={user?.email ?? "—"} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">
                  Dépôt / Entrepôt <span className="text-[#EF4444]">*</span>
                </Label>
                <Select value={depotId} onValueChange={setDepotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un dépôt" />
                  </SelectTrigger>
                  <SelectContent>
                    {depots.map((d) => (
                      <SelectItem key={d.depot_id} value={d.depot_id}>
                        {d.nom}
                        {d.is_principal ? " (Principal)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stock actuel du dépôt</Label>
                <Input readOnly value={depotId ? String(stockDepot ?? 0) : "—"} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Type d'ajustement <span className="text-[#EF4444]">*</span>
                </Label>
                <Select value={type} onValueChange={(v) => setType(v as "entree" | "sortie")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entree">Entrée (ajouter au stock)</SelectItem>
                    <SelectItem value="sortie">Sortie (retirer du stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Quantité <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nouveau stock du dépôt</Label>
                <Input
                  readOnly
                  value={qtyValide ? String(nouvelleQte) : "—"}
                  className={stockNegatif ? "border-[#EF4444] text-[#EF4444]" : ""}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Motif de l'ajustement <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex : Correction d'inventaire, Casse, Erreur de saisie…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observation</Label>
              <Textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Détails complémentaires (optionnel)"
                rows={3}
              />
            </div>

            {stockNegatif && (
              <p className="text-sm text-[#EF4444]">
                Le stock résultant serait négatif ({nouvelleQte}). Réduisez la quantité.
              </p>
            )}
            {!rolesLoading && !autorise && (
              <p className="text-sm text-[#EF4444]">
                Vous n'avez pas l'autorisation d'effectuer un ajustement de stock.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/stock" })}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting || !autorise || !depotId || !qtyValide || !motif.trim() || stockNegatif
                }
                style={{ background: "#10B981", color: "#fff" }}
              >
                {submitting ? "Enregistrement…" : "Enregistrer l'ajustement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
