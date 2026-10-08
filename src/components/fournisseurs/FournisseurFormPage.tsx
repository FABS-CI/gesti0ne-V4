import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeSupabaseError } from "@/lib/rbac-api";
import {
  createFournisseur,
  updateFournisseur,
  type Fournisseur,
  type FournisseurInput,
} from "@/lib/fournisseurs-api";
import { useServerDraft } from "@/hooks/use-server-draft";
import { DraftRestoreBanner } from "@/components/ui/draft-restore-banner";

const emptyForm: FournisseurInput = {
  raison_sociale: "",
  representant: "",
  contact: "",
  email: "",
  telephone: "",
  adresse: "",
  ville: "",
  actif: true,
};

export function FournisseurFormPage({ existing }: { existing?: Fournisseur | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!existing;
  const [form, setForm] = useState<FournisseurInput>(emptyForm);

  useEffect(() => {
    if (!existing) return;
    setForm({
      raison_sociale: existing.raison_sociale,
      representant: existing.representant ?? "",
      contact: existing.contact ?? "",
      email: existing.email ?? "",
      telephone: existing.telephone ?? "",
      adresse: existing.adresse ?? "",
      ville: existing.ville ?? "",
      actif: existing.actif,
    });
  }, [existing]);

  const draft = useServerDraft<FournisseurInput>({
    docType: "fournisseur",
    value: form,
    enabled: !isEdit,
    isEmpty: (v) => !v.raison_sociale && !v.representant && !v.telephone && !v.email,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateFournisseur(existing!.fournisseur_id, form)
        : createFournisseur(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fournisseurs"] });
      toast.success(isEdit ? "Fournisseur modifié" : "Fournisseur créé");
      if (!isEdit) void draft.markConverted();
      navigate({ to: "/fournisseurs" });
    },
    onError: (e: unknown) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  function submit() {
    if (!form.raison_sociale.trim()) {
      toast.error("La raison sociale est requise");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <Button aria-label="Retour" asChild variant="ghost" size="icon">
          <Link to="/fournisseurs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Truck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="ds-page-title">
            {isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit && existing?.reference
              ? `Référence ${existing.reference}`
              : "La référence FRS est générée automatiquement à l'enregistrement"}
          </p>
        </div>
      </div>

      {!isEdit && draft.pendingDraft ? (
        <DraftRestoreBanner
          label="fournisseur"
          updatedAt={draft.pendingDraft.updatedAt}
          onDiscard={() => void draft.discard()}
          onRestore={() => {
            const v = draft.restore();
            if (v) setForm({ ...emptyForm, ...v });
          }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Raison sociale *</Label>
            <Input
              value={form.raison_sociale}
              onChange={(e) => setForm((f) => ({ ...f, raison_sociale: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Représentant</Label>
            <Input
              value={form.representant ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, representant: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Input
              value={form.contact ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone</Label>
            <Input
              value={form.telephone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Input
              value={form.ville ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Adresse</Label>
            <Input
              value={form.adresse ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              checked={form.actif}
              onCheckedChange={(v) => setForm((f) => ({ ...f, actif: v }))}
            />
            <Label>Actif</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to="/fournisseurs">Annuler</Link>
        </Button>
        <Button onClick={submit} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
