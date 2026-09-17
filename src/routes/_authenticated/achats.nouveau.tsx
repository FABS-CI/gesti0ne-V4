import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, ShoppingBag } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatFCFA } from "@/lib/format";
import { listFournisseurs } from "@/lib/fournisseurs-api";
import { type Produit } from "@/lib/produits-api";
import { listDepots } from "@/lib/depots-api";
import {
  creerApprovisionnement,
  modifierApprovisionnement,
  getAchat,
  getAchatLignes,
} from "@/lib/achats-api";
import { invalidateAchat } from "@/lib/cache-invalidation";
import { usePermissions } from "@/hooks/use-permissions";
import { InfosGeneralesSection } from "@/components/achats/nouveau/InfosGeneralesSection";
import {
  LignesProduitsSection,
  emptyLigne,
  montantLigne,
  type LigneUI,
} from "@/components/achats/nouveau/LignesProduitsSection";
import { QuickCreateProduitDialog } from "@/components/achats/nouveau/QuickCreateProduitDialog";
import { useServerDraft } from "@/hooks/use-server-draft";
import { DraftRestoreBanner } from "@/components/ui/draft-restore-banner";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/achats/nouveau")({
  component: NouvelApprovisionnementPage,
  validateSearch: (s: Record<string, unknown>) => ({
    edit: typeof s.edit === "string" && s.edit ? String(s.edit) : undefined,
  }),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function NouvelApprovisionnementPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has, isLoading: permLoading } = usePermissions();
  const search = Route.useSearch();
  const editId = search.edit;
  const isEdit = !!editId;
  const canManage = has(isEdit ? "achats.modifier" : "achats.creer");

  const [fournisseurId, setFournisseurId] = useState<string>("");
  const [depotId, setDepotId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceFournisseur, setReferenceFournisseur] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneUI[]>([emptyLigne()]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickIndex, setQuickIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: existingAchat } = useQuery({
    queryKey: ["achat", editId],
    enabled: isEdit,
    queryFn: () => getAchat(editId!),
  });
  const { data: existingLignes } = useQuery({
    queryKey: ["achat-lignes", editId],
    enabled: isEdit,
    queryFn: () => getAchatLignes(editId!),
  });
  useEffect(() => {
    if (!isEdit || !existingAchat || !existingLignes) return;
    setFournisseurId(existingAchat.fournisseur_id ?? "");
    if ("depot_id" in existingAchat && existingAchat.depot_id) {
      setDepotId(existingAchat.depot_id as string);
    }
    setDate(existingAchat.date_achat);
    setReferenceFournisseur(existingAchat.reference_fournisseur ?? "");
    setNotes(existingAchat.notes ?? "");
    setLignes(
      existingLignes.length
        ? existingLignes.map((l) => ({
            produit_id: l.produit_id,
            reference_produit: l.reference_produit ?? "",
            designation: l.designation,
            quantite: Number(l.quantite),
            prix_unitaire: Number(l.prix_unitaire),
            remise_pct: Number(l.remise_pct ?? 0),
            cover_path: l.produits?.cover_path,
            cover_thumb_path: l.produits?.cover_thumb_path,
          }))
        : [emptyLigne()],
    );
  }, [isEdit, existingAchat, existingLignes]);

  const { data: depots = [] } = useQuery({
    queryKey: ["depots", "approv-form"],
    queryFn: () => listDepots(),
  });
  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs", ""],
    queryFn: () => listFournisseurs(),
  });
  const depotsActifs = useMemo(() => depots.filter((d) => d.actif), [depots]);
  useEffect(() => {
    if (!depotId && depotsActifs.length > 0) {
      const principal = depotsActifs.find((d) => d.is_principal) ?? depotsActifs[0];
      if (principal) setDepotId(principal.depot_id);
    }
  }, [depotId, depotsActifs]);

  const montantTotal = useMemo(() => lignes.reduce((s, l) => s + montantLigne(l), 0), [lignes]);
  const qteTotale = useMemo(() => lignes.reduce((s, l) => s + (l.quantite || 0), 0), [lignes]);

  // Brouillon serveur (reprise de saisie) — création uniquement
  const draftValue = useMemo(
    () => ({ fournisseurId, depotId, date, referenceFournisseur, notes, lignes }),
    [fournisseurId, depotId, date, referenceFournisseur, notes, lignes],
  );
  const draft = useServerDraft<typeof draftValue>({
    docType: "bon_reception",
    value: draftValue,
    enabled: !isEdit,
    isEmpty: (v) => !v.fournisseurId && v.lignes.every((l) => !l.produit_id && !l.designation),
  });

  // Clé d'idempotence stable pour toute la durée de saisie (anti-doublon)
  const idempotencyKey = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `appro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        fournisseur_id: fournisseurId,
        depot_id: depotId,
        date_achat: date,
        reference_fournisseur: referenceFournisseur || null,
        notes: notes || null,
        idempotency_key: isEdit ? null : idempotencyKey,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          reference_produit: l.reference_produit || null,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise_pct: l.remise_pct ?? 0,
        })),
      };
      return isEdit
        ? modifierApprovisionnement(editId!, payload)
        : creerApprovisionnement(payload);
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "Approvisionnement modifié avec succès" : "Approvisionnement enregistré avec succès",
      );
      invalidateAchat(qc, { fournisseurId });
      if (isEdit && editId) {
        qc.invalidateQueries({ queryKey: ["achat", editId] });
        qc.invalidateQueries({ queryKey: ["achat-lignes", editId] });
      }
      if (!isEdit) void draft.markConverted();
      setConfirmOpen(false);
      navigate({ to: "/achats" });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Erreur";
      toast.error(msg);
    },
  });

  function updateLigne(i: number, patch: Partial<LigneUI>) {
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLigne() {
    setLignes((arr) => [...arr, emptyLigne()]);
  }
  function removeLigne(i: number) {
    setLignes((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));
  }
  function onPickProduit(i: number, p: Produit | null) {
    if (!p) {
      updateLigne(i, {
        produit_id: null,
        reference_produit: "",
        designation: "",
        prix_unitaire: 0,
      });
      return;
    }
    updateLigne(i, {
      produit_id: p.produit_id,
      reference_produit: p.reference,
      designation: p.titre,
      prix_unitaire: p.prix_achat || 0,
      cover_path: p.cover_path,
      cover_thumb_path: p.cover_thumb_path,
    });
  }

  function validate(): string | null {
    if (!fournisseurId) return "Sélectionnez un fournisseur";
    if (!depotId) return "Sélectionnez un dépôt de destination";
    if (lignes.length === 0) return "Ajoutez au moins une ligne produit";

    for (const [i, l] of lignes.entries()) {
      if (!l.produit_id) return `Ligne ${i + 1} : sélectionnez un produit`;
      if (!l.quantite || l.quantite <= 0) return `Ligne ${i + 1} : quantité invalide`;
      if (l.prix_unitaire < 0) return `Ligne ${i + 1} : prix d'achat invalide`;
    }
    return null;
  }

  function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setConfirmOpen(true);
  }

  const fournisseurNom =
    fournisseurs.find((f) => f.fournisseur_id === fournisseurId)?.raison_sociale ?? "—";
  const depotNom = depotsActifs.find((d) => d.depot_id === depotId)?.nom ?? "—";

  if (!permLoading && !canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation d'enregistrer un approvisionnement.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/achats">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/achats">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <ShoppingBag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Modifier l'approvisionnement" : "Nouvel Approvisionnement"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Édition complète : lignes, quantités, prix, dépôt et fournisseur"
              : "Réception de marchandises livrées par un fournisseur"}
          </p>
        </div>
      </div>

      {!isEdit && draft.pendingDraft ? (
        <DraftRestoreBanner
          label="bon de réception"
          updatedAt={draft.pendingDraft.updatedAt}
          onDiscard={() => void draft.discard()}
          onRestore={() => {
            const v = draft.restore();
            if (!v) return;
            setFournisseurId(v.fournisseurId ?? "");
            setDepotId(v.depotId ?? "");
            setDate(v.date ?? date);
            setReferenceFournisseur(v.referenceFournisseur ?? "");
            setNotes(v.notes ?? "");
            setLignes(v.lignes?.length ? v.lignes : [emptyLigne()]);
          }}
        />
      ) : null}

      <InfosGeneralesSection
        fournisseurId={fournisseurId}
        onFournisseurChange={setFournisseurId}
        depotId={depotId}
        onDepotChange={setDepotId}
        depotsActifs={depotsActifs}
        date={date}
        onDateChange={setDate}
        referenceFournisseur={referenceFournisseur}
        onReferenceFournisseurChange={setReferenceFournisseur}
        notes={notes}
        onNotesChange={setNotes}
      />

      <LignesProduitsSection
        lignes={lignes}
        onUpdate={updateLigne}
        onAdd={addLigne}
        onRemove={removeLigne}
        onPick={onPickProduit}
        onOpenQuickCreate={(i) => {
          setQuickIndex(i);
          setQuickOpen(true);
        }}
        qteTotale={qteTotale}
        montantTotal={montantTotal}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link to="/achats">Annuler</Link>
        </Button>
        <Button onClick={submit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmer l'approvisionnement</DialogTitle>
            <DialogDescription>
              Vérifiez les informations avant enregistrement définitif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-muted-foreground">Fournisseur</div>
                <div className="font-medium">{fournisseurNom}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Magasin / Dépôt</div>
                <div className="font-medium">{depotNom}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-medium">{formatDate(date)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Référence fournisseur</div>
                <div className="font-medium">{referenceFournisseur || "—"}</div>
              </div>
            </div>
            <div className="rounded-md border max-h-64 overflow-auto">
              <table className="w-full text-sm table-zebra-orange table-print-borders">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-2">Produit</th>
                    <th className="text-right p-2">Qté</th>
                    <th className="text-right p-2">P.U.</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 flex items-center gap-2">
                        <ProductCoverThumb
                          produit={{
                            titre: l.designation,
                            cover_path: l.cover_path,
                            cover_thumb_path: l.cover_thumb_path,
                          }}
                          size="xs"
                        />
                        <div className="flex flex-col">
                          <span>{l.designation}</span>
                          {l.reference_produit ? (
                            <span className="text-xs text-muted-foreground">
                              ({l.reference_produit})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2 text-right">{l.quantite}</td>
                      <td className="p-2 text-right">{formatFCFA(l.prix_unitaire)}</td>
                      <td className="p-2 text-right font-medium">
                        {formatFCFA((l.quantite || 0) * (l.prix_unitaire || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-muted-foreground">
                Articles : <b>{lignes.length}</b> · Quantité totale : <b>{qteTotale}</b>
              </span>
              <span className="text-base font-bold">
                Montant total : {formatFCFA(montantTotal)}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={saveMutation.isPending}
            >
              Annuler
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={saveMutation.isPending}
              >
                Retour à la modification
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Enregistrement…" : "Confirmer l'approvisionnement"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCreateProduitDialog
        open={quickOpen}
        onOpenChange={(o) => {
          setQuickOpen(o);
          if (!o) setQuickIndex(null);
        }}
        onCreated={(p) => {
          // refresh produit list
          qc.invalidateQueries({ queryKey: ["produits"] });
          if (quickIndex != null) {
            updateLigne(quickIndex, {
              produit_id: p.produit_id,
              reference_produit: p.reference,
              designation: p.titre,
              prix_unitaire: p.prix_achat || 0,
            });
          }
          setQuickOpen(false);
          setQuickIndex(null);
        }}
      />
    </div>
  );
}
