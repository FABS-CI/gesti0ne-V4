import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { usePermissions } from "@/hooks/use-permissions";
import { getPlanComptable, type CompteRow } from "@/lib/compta-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { callRpc } from "@/lib/rpc";

export const Route = createFileRoute("/_authenticated/plan-comptable")({
  component: PlanComptablePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const CLASSES: Record<string, string> = {
  "1": "Ressources durables",
  "2": "Actif immobilisé",
  "3": "Stocks",
  "4": "Tiers",
  "5": "Trésorerie",
  "6": "Charges",
  "7": "Produits",
  "8": "Autres charges et produits",
  "9": "Engagements hors bilan et analytique",
};

type Filtre = "tous" | "mouvementes" | "absents" | "inactifs";
type Edition = {
  compte_id: string | null;
  numero: string;
  libelle: string;
  actif: boolean;
  utilise: boolean;
};

function PlanComptablePage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const peutCreer = has("plan_comptable.creer");
  const peutModifier = has("plan_comptable.modifier");

  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState("toutes");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [edition, setEdition] = useState<Edition | null>(null);

  const q = useQuery({ queryKey: ["plan-comptable"], queryFn: getPlanComptable });
  const comptes = useMemo(() => q.data ?? [], [q.data]);
  const absents = comptes.filter((c) => !c.dans_plan);

  const lignes = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    return comptes.filter(
      (c) =>
        (classe === "toutes" || c.numero.startsWith(classe)) &&
        (filtre === "tous" ||
          (filtre === "mouvementes" && c.nb_lignes > 0) ||
          (filtre === "absents" && !c.dans_plan) ||
          (filtre === "inactifs" && !c.actif)) &&
        (!t || c.numero.startsWith(t) || c.libelle.toLowerCase().includes(t)),
    );
  }, [comptes, recherche, classe, filtre]);

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ["plan-comptable"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
  };

  const enregistrer = useMutation({
    mutationFn: async (e: Edition) => {
      const { error } = await callRpc(
        "compta_plan_enregistrer",
        {
          p_compte_id: e.compte_id,
          p_numero: e.numero.trim(),
          p_libelle: e.libelle.trim(),
          p_actif: e.actif,
        },
        { module: "comptabilite" },
      );
      if (error) throw error;
    },
    onSuccess: (_, e) => {
      toast.success(`Compte ${e.numero.trim()} enregistré`);
      setEdition(null);
      invalider();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const importer = useMutation({
    mutationFn: async () => {
      const { data, error } = await callRpc(
        "compta_plan_importer_absents",
        {},
        { module: "comptabilite" },
      );
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (n) => {
      toast.success(`${n} compte(s) ajouté(s) au plan, avec le libellé de leurs écritures`);
      invalider();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const ouvrir = (c?: CompteRow) =>
    setEdition(
      c
        ? {
            compte_id: c.compte_id,
            numero: c.numero,
            libelle: c.libelle,
            actif: c.actif,
            utilise: c.nb_lignes > 0,
          }
        : { compte_id: null, numero: "", libelle: "", actif: true, utilise: false },
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">Plan comptable</h1>
          <p className="text-sm text-muted-foreground">
            Référentiel SYSCOHADA révisé : {comptes.filter((c) => c.dans_plan).length} comptes, dont{" "}
            {comptes.filter((c) => c.nb_lignes > 0).length} mouvementés
          </p>
        </div>
        {peutCreer && (
          <Button size="sm" onClick={() => ouvrir()}>
            Nouveau compte
          </Button>
        )}
      </div>

      {absents.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>
            {absents.length} compte(s) utilisé(s) par des écritures mais absents du plan
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Ils apparaissent dans la balance sans libellé de référence. Vérifiez-les, puis
              ajoutez-les au plan (libellé le plus fréquent de leurs écritures, modifiable ensuite).
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setFiltre("absents")}>
                Voir
              </Button>
              {peutCreer && (
                <Button size="sm" disabled={importer.isPending} onClick={() => importer.mutate()}>
                  {importer.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Ajouter au plan
                </Button>
              )}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="recherche-compte">Recherche</Label>
            <div className="relative">
              <Input
                id="recherche-compte"
                placeholder="Numéro ou libellé"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Classe</Label>
            <Select value={classe} onValueChange={setClasse}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les classes</SelectItem>
                {Object.entries(CLASSES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {k} — {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Afficher</Label>
            <Select value={filtre} onValueChange={(v) => setFiltre(v as Filtre)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les comptes</SelectItem>
                <SelectItem value="mouvementes">Comptes mouvementés</SelectItem>
                <SelectItem value="absents">Absents du plan</SelectItem>
                <SelectItem value="inactifs">Désactivés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {q.error ? (
            <p className="p-4 text-sm text-destructive">
              {friendlyError(q.error, "Plan comptable indisponible")}
            </p>
          ) : (
            <ResponsiveTable stickyFirstCol>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead>Dernier mouvement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Chargement…
                      </TableCell>
                    </TableRow>
                  ) : lignes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Aucun compte ne correspond aux filtres
                      </TableCell>
                    </TableRow>
                  ) : (
                    lignes.map((c) => {
                      const solde = c.debit - c.credit;
                      // Retrait selon la longueur du numéro : classe, compte principal, sous-comptes.
                      const retrait = Math.min(c.numero.length - 1, 4);
                      return (
                        <TableRow
                          key={`${c.numero}-${c.dans_plan}`}
                          className={c.numero.length <= 2 ? "bg-muted/40 font-semibold" : undefined}
                        >
                          <TableCell
                            className="font-mono"
                            style={{ paddingLeft: `${0.75 + retrait * 0.75}rem` }}
                          >
                            {c.numero}
                          </TableCell>
                          <TableCell>{c.libelle || "—"}</TableCell>
                          <TableCell className="text-right">
                            {c.debit ? formatFCFA(c.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.credit ? formatFCFA(c.credit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {c.nb_lignes > 0
                              ? `${formatFCFA(Math.abs(solde))} ${solde >= 0 ? "D" : "C"}`
                              : ""}
                          </TableCell>
                          <TableCell>
                            {c.dernier_mouvement ? formatDate(c.dernier_mouvement) : ""}
                          </TableCell>
                          <TableCell>
                            {!c.dans_plan ? (
                              <Badge variant="destructive">Absent du plan</Badge>
                            ) : !c.actif ? (
                              <Badge variant="outline">Désactivé</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {c.dans_plan && peutModifier && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Modifier le compte ${c.numero}`}
                                onClick={() => ouvrir(c)}
                              >
                                Modifier
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!edition} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edition?.compte_id ? `Compte ${edition.numero}` : "Nouveau compte"}
            </DialogTitle>
            <DialogDescription>
              Le premier chiffre est la classe (1 à 9) ; le compte est rattaché automatiquement à
              son compte parent.
              {edition?.utilise &&
                " Ce compte est utilisé par des écritures : son numéro est figé, mais il peut être désactivé."}
            </DialogDescription>
          </DialogHeader>
          {edition && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="numero-compte">Numéro</Label>
                <Input
                  id="numero-compte"
                  className="font-mono"
                  inputMode="numeric"
                  disabled={edition.utilise}
                  value={edition.numero}
                  onChange={(e) =>
                    setEdition({ ...edition, numero: e.target.value.replace(/\D/g, "") })
                  }
                />
                {/^[1-9]/.test(edition.numero) && (
                  <p className="text-xs text-muted-foreground">
                    Classe {edition.numero[0]} — {CLASSES[edition.numero[0]]}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="libelle-compte">Libellé</Label>
                <Input
                  id="libelle-compte"
                  maxLength={200}
                  value={edition.libelle}
                  onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={edition.actif}
                  onCheckedChange={(v) => setEdition({ ...edition, actif: v })}
                />
                Compte actif (utilisable en saisie)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdition(null)}>
              Annuler
            </Button>
            <Button
              disabled={
                !edition ||
                enregistrer.isPending ||
                !/^[1-9]\d*$/.test(edition.numero) ||
                edition.libelle.trim().length < 2
              }
              onClick={() => edition && enregistrer.mutate(edition)}
            >
              {enregistrer.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
