import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Eye } from "lucide-react";
import type { PdfTemplate } from "@/lib/pdf/pdfConfig";
import type { FormState } from "@/lib/modeles-documents-helpers";
import { Apercu } from "./Apercu";
import { ColorField } from "./ColorField";

type Props = {
  open: boolean;
  setOpen: (o: boolean) => void;
  editingId: string | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
  onApercuPdfActif: () => void;
};

export function TemplateEditorDialog({
  open,
  setOpen,
  editingId,
  form,
  setForm,
  saving,
  onSave,
  onApercuPdfActif,
}: Props) {
  const previewTemplate: PdfTemplate = { ...form, id: "preview", custom: true };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Modifier le modèle" : "Nouveau modèle de document"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom du modèle</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Style d'en-tête</Label>
              <Select
                value={form.headerVariant}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, headerVariant: v as FormState["headerVariant"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classique">Bandeau (titre à droite)</SelectItem>
                  <SelectItem value="moderne">Bandeau centré</SelectItem>
                  <SelectItem value="premium">Sobre centré (filet)</SelectItem>
                  <SelectItem value="corporate">Bandeau plein</SelectItem>
                  <SelectItem value="administratif">Administratif (trait)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Police</Label>
              <Select
                value={form.font}
                onValueChange={(v) => setForm((f) => ({ ...f, font: v as FormState["font"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helvetica">Helvetica (sans serif)</SelectItem>
                  <SelectItem value="times">Times (serif)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColorField
              label="Fond d'en-tête"
              value={form.headerBg ?? [255, 255, 255]}
              onChange={(c) => setForm((f) => ({ ...f, headerBg: c }))}
            />
            <ColorField
              label="Texte société"
              value={form.companyColor}
              onChange={(c) => setForm((f) => ({ ...f, companyColor: c }))}
            />
            <ColorField
              label="Couleur du titre"
              value={form.titleColor}
              onChange={(c) => setForm((f) => ({ ...f, titleColor: c }))}
            />
            <ColorField
              label="Fond entête tableau"
              value={form.tableHeadFill}
              onChange={(c) => setForm((f) => ({ ...f, tableHeadFill: c }))}
            />
            <ColorField
              label="Couleur accent / totaux"
              value={form.accent}
              onChange={(c) => setForm((f) => ({ ...f, accent: c }))}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Encadrer les totaux</Label>
              <Switch
                checked={form.totalBoxed}
                onCheckedChange={(v) => setForm((f) => ({ ...f, totalBoxed: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mention de pied de page</Label>
              <Textarea
                rows={2}
                placeholder="Laisser vide pour la mention légale par défaut"
                value={form.footerNote ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, footerNote: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Aperçu en direct</Label>
            <Apercu t={previewTemplate} />
            <Button size="sm" variant="outline" className="w-full" onClick={onApercuPdfActif}>
              <Eye className="mr-1 h-4 w-4" /> Aperçu PDF (modèle actif)
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={saving || !form.label.trim()}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {editingId ? "Enregistrer" : "Créer le modèle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
