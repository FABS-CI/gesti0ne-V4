import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  annulerInventaire,
  getInventaire,
  getInventaireLignes,
  regulariserInventaire,
  STATUT_INVENTAIRE_LABEL,
  validerInventairePhysique,
  supprimerInventaire,
  verrouillerInventaire,
  deverrouillerInventaire,
} from "@/lib/inventaires-api";
import { usePermissions } from "@/hooks/use-permissions";
import { exportInventaireCsv } from "@/lib/inventaire-detail-export";
import { InventaireKpis } from "@/components/inventaires/detail/InventaireKpis";
import { InventaireLignesTable } from "@/components/inventaires/detail/InventaireLignesTable";
import { InventaireHeaderActions } from "@/components/inventaires/detail/InventaireHeaderActions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/inventaires/$inventaireId")({
  component: InventaireDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function InventaireDetailPage() {
  const { inventaireId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canValider = has("inventaires.valider");
  const canRegulariserPerm = has("inventaires.regulariser");

  const { data: inv, isLoading } = useQuery({
    queryKey: ["inventaire", inventaireId],
    queryFn: () => getInventaire(inventaireId),
  });
  const { data: lignes = [] } = useQuery({
    queryKey: ["inventaire-lignes", inventaireId],
    queryFn: () => getInventaireLignes(inventaireId),
  });

  const [comptes, setComptes] = useState<Record<string, number>>({});
  const [obs, setObs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lignes.length === 0) return;
    setComptes((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const m: Record<string, number> = {};
      lignes.forEach((l) => (m[l.ligne_id] = l.quantite_comptee));
      return m;
    });
    setObs((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const m: Record<string, string> = {};
      lignes.forEach((l) => (m[l.ligne_id] = l.observation ?? ""));
      return m;
    });
  }, [lignes]);

  const ecartsLive = useMemo(
    () =>
      lignes.map((l) => {
        const compte = comptes[l.ligne_id] ?? l.quantite_comptee;
        return { ligne: l, compte, ecart: compte - l.stock_theorique };
      }),
    [lignes, comptes],
  );

  const totaux = useMemo(() => {
    let nbEcarts = 0;
    let valeur = 0;
    ecartsLive.forEach(({ ligne, compte, ecart }) => {
      if (ecart !== 0) nbEcarts++;
      valeur += compte * Number(ligne.valeur_unitaire);
    });
    return { nbEcarts, valeur };
  }, [ecartsLive]);

  const validerMut = useMutation({
    mutationFn: () =>
      validerInventairePhysique(
        inventaireId,
        lignes.map((l) => ({
          ligne_id: l.ligne_id,
          quantite_comptee: comptes[l.ligne_id] ?? 0,
          observation: obs[l.ligne_id] ?? null,
        })),
      ),
    onSuccess: () => {
      toast.success("Inventaire validé");
      qc.invalidateQueries({ queryKey: ["inventaire", inventaireId] });
      qc.invalidateQueries({ queryKey: ["inventaire-lignes", inventaireId] });
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const regulariserMut = useMutation({
    mutationFn: () => regulariserInventaire(inventaireId),
    onSuccess: () => {
      toast.success("Écarts régularisés (mouvements d'ajustement créés)");
      qc.invalidateQueries({ queryKey: ["inventaire", inventaireId] });
      qc.invalidateQueries({ queryKey: ["inventaires"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock_mouvements"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const annulerMut = useMutation({
    mutationFn: () => annulerInventaire(inventaireId),
    onSuccess: () => {
      toast.success("Inventaire annulé");
      navigate({ to: "/inventaires" });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const supprimerMut = useMutation({
    mutationFn: () => supprimerInventaire(inventaireId),
    onSuccess: () => {
      toast.success("Inventaire supprimé");
      navigate({ to: "/inventaires" });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const verrouillerMut = useMutation({
    mutationFn: () => verrouillerInventaire(inventaireId),
    onSuccess: () => {
      toast.success("Inventaire verrouillé");
      qc.invalidateQueries({ queryKey: ["inventaire", inventaireId] });
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const deverrouillerMut = useMutation({
    mutationFn: () => deverrouillerInventaire(inventaireId),
    onSuccess: () => {
      toast.success("Inventaire déverrouillé");
      qc.invalidateQueries({ queryKey: ["inventaire", inventaireId] });
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!inv) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Inventaire introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/inventaires">Retour</Link>
        </Button>
      </div>
    );
  }

  const st = STATUT_INVENTAIRE_LABEL[inv.statut] ?? { label: inv.statut, color: "#94A3B8" };
  const editable = inv.statut === "brouillon" && canValider;
  const canRegulariser = inv.statut === "valide" && canRegulariserPerm && !!inv.depot_id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/inventaires">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="ds-page-title">{inv.numero}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              Inventaire {inv.type_inventaire} ·{" "}
              {new Date(inv.date_inventaire).toLocaleDateString("fr-FR")} ·{" "}
              {inv.depots?.nom ?? "Tous dépôts"}
            </p>
          </div>
          <Badge style={{ backgroundColor: st.color, color: "white" }}>{st.label}</Badge>
        </div>
        <InventaireHeaderActions
          editable={editable}
          canRegulariser={canRegulariser}
          nbEcarts={inv.nb_ecarts}
          locked={inv.statut === "valide"}
          onExport={() => exportInventaireCsv(inv, ecartsLive, obs, totaux)}
          onAnnuler={() => annulerMut.mutate()}
          onValider={() => validerMut.mutate()}
          onRegulariser={() => regulariserMut.mutate()}
          onVerrouiller={() => verrouillerMut.mutate()}
          onDeverrouiller={() => deverrouillerMut.mutate()}
          onSupprimer={() => supprimerMut.mutate()}
          onImprimer={() => window.print()}
          validating={validerMut.isPending}
        />
      </div>

      <InventaireKpis
        nbLignes={lignes.length}
        nbEcarts={editable ? totaux.nbEcarts : inv.nb_ecarts}
        valeur={editable ? totaux.valeur : inv.valeur_totale}
        editable={editable}
        createdByNom={inv.created_by_nom ?? null}
      />

      <InventaireLignesTable
        ecartsLive={ecartsLive}
        editable={editable}
        obs={obs}
        onCompte={(id, v) => setComptes((p) => ({ ...p, [id]: v }))}
        onObs={(id, v) => setObs((p) => ({ ...p, [id]: v }))}
      />
    </div>
  );
}
