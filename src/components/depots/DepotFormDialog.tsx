import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TYPES_DEPOT, type DepotInput } from "@/lib/depots-api";
import { friendlyError } from "@/lib/friendly-error";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  form: DepotInput;
  setForm: React.Dispatch<React.SetStateAction<DepotInput>>;
  onSubmit: () => void;
  submitting: boolean;
}

export function DepotFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSubmit,
  submitting,
}: Props) {
  function captureGps() {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non disponible sur ce navigateur");
      return;
    }
    toast.loading("Récupération de la position…", { id: "gps" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: Number(pos.coords.latitude.toFixed(7)),
          longitude: Number(pos.coords.longitude.toFixed(7)),
        }));
        toast.success("Position récupérée", { id: "gps" });
      },
      (err) => toast.error(`Échec : ${friendlyError(err)}`, { id: "gps" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le dépôt" : "Nouveau dépôt"}</DialogTitle>
        </DialogHeader>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">1. Informations générales</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="DEP-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type_depot}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    type_depot: v,
                    is_principal: v === "principal" ? f.is_principal : false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_DEPOT.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Capacité (optionnel)</Label>
              <Input
                type="number"
                value={form.capacite ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    capacite: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">2. Localisation</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Input
                value={form.pays ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, pays: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input
                value={form.ville ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Commune</Label>
              <Input
                value={form.commune ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, commune: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quartier</Label>
              <Input
                value={form.quartier ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, quartier: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Adresse complète</Label>
              <Input
                value={form.adresse ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code postal</Label>
              <Input
                value={form.code_postal ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, code_postal: e.target.value }))}
              />
            </div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">3. Géolocalisation GPS</h3>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={captureGps}>
                Ma position
              </Button>
              {form.latitude && form.longitude && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <a
                    href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Carte
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.latitude ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    latitude: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.longitude ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    longitude: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">4. Responsable</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.responsable ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input
                value={form.telephone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.responsable_email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, responsable_email: e.target.value }))}
              />
            </div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.actif}
              onCheckedChange={(v) => setForm((f) => ({ ...f, actif: v }))}
            />
            <Label>Dépôt actif</Label>
          </div>
          {form.type_depot === "principal" && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_principal}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_principal: v }))}
              />
              <Label>Marquer comme dépôt principal (un seul autorisé)</Label>
            </div>
          )}
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
