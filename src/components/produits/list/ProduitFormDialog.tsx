import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { CATEGORIES_PRODUIT } from "@/lib/company";
import type { Produit, ProduitInput } from "@/lib/produits-api";
import { ProductCoverSection } from "@/components/produits/ProductCoverSection";

function SubHeader({ title, color }: { title: string; color: string }) {
  return (
    <div className="relative sm:col-span-2 rounded-md bg-muted/30 pl-5 pr-3 py-2 mt-2">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 rounded-l-md"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-2 text-sm font-semibold">{title}</div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: ProduitInput;
  setForm: React.Dispatch<React.SetStateAction<ProduitInput>>;
  onSave: () => void;
  saving: boolean;
  /** Produit en cours d'édition (fournit `produit_id` pour l'upload de couverture). */
  produit?: Produit | null;
  /** Appelé après un upload / suppression de couverture pour rafraîchir les listes. */
  onCoverChanged?: () => void;
}

export function ProduitFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSave,
  saving,
  produit,
  onCoverChanged,
}: Props) {
  const setField = <K extends keyof ProduitInput>(key: K, value: ProduitInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        {editing && produit && <ProductCoverSection produit={produit} onChanged={onCoverChanged} />}
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <SubHeader title="Général" color="#3B82F6" />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Titre *</Label>
            <Input value={form.titre} onChange={(e) => setField("titre", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie *</Label>
            <Select value={form.categorie} onValueChange={(v) => setField("categorie", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES_PRODUIT.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SubHeader title="Classification" color="#8B5CF6" />
          <div className="space-y-1.5">
            <Label>ISBN</Label>
            <Input value={form.isbn ?? ""} onChange={(e) => setField("isbn", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Niveau</Label>
            <Input value={form.niveau ?? ""} onChange={(e) => setField("niveau", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Matière</Label>
            <Input
              value={form.matiere ?? ""}
              onChange={(e) => setField("matiere", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Auteur</Label>
            <Input value={form.auteur ?? ""} onChange={(e) => setField("auteur", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Éditeur</Label>
            <Input
              value={form.editeur ?? ""}
              onChange={(e) => setField("editeur", e.target.value)}
            />
          </div>
          <SubHeader title="Prix" color="#10B981" />
          <div className="space-y-1.5">
            <Label>Prix de vente</Label>
            <Input
              type="number"
              value={form.prix_vente ?? 0}
              onChange={(e) => setField("prix_vente", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prix d'achat</Label>
            <Input
              type="number"
              value={form.prix_achat ?? 0}
              onChange={(e) => setField("prix_achat", Number(e.target.value))}
            />
          </div>
          <SubHeader title="Stock" color="#F97316" />
          <div className="space-y-1.5 opacity-70">
            <Label>Stock</Label>
            <p className="text-xs text-muted-foreground">
              Le stock est désormais calculé automatiquement comme la somme des quantités de chaque
              dépôt. Pour l'alimenter ou l'ajuster, passez par <code>/stock/mouvements</code> ou un
              inventaire.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Seuil d'alerte</Label>
            <Input
              type="number"
              value={form.seuil_alerte ?? 0}
              onChange={(e) => setField("seuil_alerte", Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
