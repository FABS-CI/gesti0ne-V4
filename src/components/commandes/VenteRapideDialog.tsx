import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, UserPlus, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listClients, createClient } from "@/lib/clients-api";
import { TYPE_CLIENTS } from "@/lib/company";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/friendly-error";

export function VenteRapideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canCreateClient = has("clients.creer");
  const [nom, setNom] = useState("");
  const [representant, setRepresentant] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [type, setType] = useState("autre");
  const [saving, setSaving] = useState(false);

  const term = useDebouncedValue((nom.trim() || telephone.trim()), 300);
  const { data, isFetching } = useQuery({
    queryKey: ["vente-rapide-clients", term],
    queryFn: () => listClients({ q: term, actif: true, pageSize: 6 }),
    enabled: open && term.length >= 2,
  });
  const matches = data?.items ?? [];

  const go = (clientId: string) => {
    onOpenChange(false);
    navigate({ to: "/commandes/nouvelle", search: { clientId } });
  };

  const create = async () => {
    if (!nom.trim() || saving) return;
    setSaving(true);
    try {
      const c = await createClient({
        nom: nom.trim().slice(0, 200),
        type_client: type,
        representant: representant.trim() || null,
        ville: ville.trim() || null,
        telephone: telephone.trim() || null,
      });
      toast.success("Client créé");
      go(c.client_id);
    } catch (e) {
      toast.error(friendlyError(e, "Création du client impossible"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vente rapide</DialogTitle>
          <DialogDescription>
            Saisissez le client : s'il existe déjà, sélectionnez-le ; sinon créez-le, puis passez aux articles.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="vr-nom">Nom du client</Label>
            <Input id="vr-nom" autoFocus maxLength={200} value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vr-rep">Représentant</Label>
            <Input id="vr-rep" maxLength={150} value={representant} onChange={(e) => setRepresentant(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vr-ville">Ville</Label>
            <Input id="vr-ville" maxLength={100} value={ville} onChange={(e) => setVille(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vr-tel">Numéro de téléphone</Label>
            <Input id="vr-tel" type="tel" maxLength={30} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type de client</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_CLIENTS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Clients existants {isFetching && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
          </p>
          {term.length < 2 ? (
            <p className="text-sm text-muted-foreground">Tapez au moins 2 caractères du nom ou du téléphone.</p>
          ) : matches.length === 0 && !isFetching ? (
            <p className="text-sm text-muted-foreground">Aucun client correspondant.</p>
          ) : (
            <ul className="max-h-48 divide-y overflow-auto rounded-lg border">
              {matches.map((c) => (
                <li key={c.client_id} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.reference, c.representant, c.ville, c.telephone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => go(c.client_id)}>
                    <Check className="mr-1 h-4 w-4" /> Sélectionner
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canCreateClient && (
          <Button onClick={create} disabled={!nom.trim() || saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Créer ce nouveau client
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
