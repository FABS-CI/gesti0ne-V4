import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Save } from "lucide-react";
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
import { listDepots } from "@/lib/depots-api";
import { supabase } from "@/integrations/supabase/client";
import { creerInventairePhysique } from "@/lib/inventaires-api";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/inventaires/nouveau-physique")({
  component: NouveauPhysiquePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function NouveauPhysiquePage() {
  const navigate = useNavigate();
  const { has, isLoading: permLoading } = usePermissions();
  const canManage = has("inventaires.creer");

  const [depotId, setDepotId] = useState("");
  const [categorieId, setCategorieId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState("");

  const { data: depots = [] } = useQuery({
    queryKey: ["depots", "inv-form"],
    queryFn: () => listDepots(),
  });
  const depotsActifs = depots.filter((d) => d.actif);
  useEffect(() => {
    if (!depotId && depotsActifs.length > 0) {
      const p = depotsActifs.find((d) => d.is_principal) ?? depotsActifs[0];
      if (p) setDepotId(p.depot_id);
    }
  }, [depotId, depotsActifs]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories_produits-light"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories_produits")
        .select("categorie_id, libelle")
        .order("libelle");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      creerInventairePhysique({
        depot_id: depotId,
        categorie_id: categorieId || null,
        date_inventaire: date,
        observations: observations || null,
      }),
    onSuccess: (inv) => {
      toast.success(`Inventaire ${inv.numero} créé. Saisissez les quantités comptées.`);
      navigate({
        to: "/inventaires/$inventaireId",
        params: { inventaireId: inv.inventaire_id },
      });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (!permLoading && !canManage) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation de créer un inventaire.
        </p>
        <Button asChild variant="outline">
          <Link to="/inventaires">Retour</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/inventaires">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Nouvel inventaire physique</h1>
          <p className="text-sm text-muted-foreground">
            Génère la liste des produits du dépôt avec leur stock théorique actuel
          </p>
        </div>
      </div>

      <section className="rounded-md border bg-card p-5 space-y-4">
        <div>
          <Label>Date de l'inventaire *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Dépôt *</Label>
          <Select value={depotId} onValueChange={setDepotId}>
            <SelectTrigger>
              <SelectValue placeholder="— Sélectionnez un dépôt —" />
            </SelectTrigger>
            <SelectContent>
              {depotsActifs.map((d) => (
                <SelectItem key={d.depot_id} value={d.depot_id}>
                  {d.nom} {d.is_principal ? "(principal)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Catégorie (optionnel)</Label>
          <Select
            value={categorieId || "all"}
            onValueChange={(v) => setCategorieId(v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.categorie_id} value={c.categorie_id}>
                  {c.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Observations</Label>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button asChild variant="outline">
          <Link to="/inventaires">Annuler</Link>
        </Button>
        <Button
          onClick={() => {
            if (!depotId) {
              toast.error("Sélectionnez un dépôt");
              return;
            }
            mutation.mutate();
          }}
          disabled={mutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {mutation.isPending ? "Création…" : "Créer & saisir le comptage"}
        </Button>
      </div>
    </div>
  );
}
