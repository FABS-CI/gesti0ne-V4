import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import { adminCreateUser, adminUpdateUserProfile } from "@/lib/users-admin.functions";
import { useRolesQuery } from "@/hooks/use-roles-permissions";
import { friendlyError } from "@/lib/friendly-error";

export interface UserEditPayload {
  id: string;
  email: string | null;
  nom_complet: string | null;
  prenom?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  departement?: string | null;
  avatar_url?: string | null;
  actif: boolean;
  role_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: UserEditPayload | null;
}

export function UserFormDialog({ open, onOpenChange, editing }: Props) {
  const isEdit = !!editing;
  const qc = useQueryClient();
  const rolesQ = useRolesQuery();
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUserProfile);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm: "",
    nom_complet: "",
    prenom: "",
    telephone: "",
    fonction: "",
    departement: "",
    actif: true,
    role_ids: new Set<string>(),
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        email: editing.email ?? "",
        password: "",
        confirm: "",
        nom_complet: editing.nom_complet ?? "",
        prenom: editing.prenom ?? "",
        telephone: editing.telephone ?? "",
        fonction: editing.fonction ?? "",
        departement: editing.departement ?? "",
        actif: editing.actif,
        role_ids: new Set(editing.role_ids),
      });
    } else {
      setForm({
        email: "",
        password: "",
        confirm: "",
        nom_complet: "",
        prenom: "",
        telephone: "",
        fonction: "",
        departement: "",
        actif: true,
        role_ids: new Set(),
      });
    }
  }, [open, editing]);

  const toggleRole = (roleId: string, on: boolean) => {
    setForm((f) => {
      const s = new Set(f.role_ids);
      if (on) s.add(roleId);
      else s.delete(roleId);
      return { ...f, role_ids: s };
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const profile = {
        nom_complet: form.nom_complet.trim(),
        prenom: form.prenom.trim() || null,
        telephone: form.telephone.trim() || null,
        fonction: form.fonction.trim() || null,
        departement: form.departement.trim() || null,
        actif: form.actif,
      };
      if (!profile.nom_complet) throw new Error("Nom complet requis");

      if (isEdit && editing) {
        if (form.password && form.password !== form.confirm) {
          throw new Error("Les mots de passe ne correspondent pas");
        }
        return updateFn({
          data: {
            user_id: editing.id,
            profile,
            role_ids: Array.from(form.role_ids),
            new_password: form.password || null,
          },
        });
      }
      if (!form.email) throw new Error("Email requis");
      if (form.password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
      if (form.password !== form.confirm) throw new Error("Les mots de passe ne correspondent pas");
      return createFn({
        data: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          profile,
          role_ids: Array.from(form.role_ids),
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Utilisateur mis à jour" : "Utilisateur créé");
      qc.invalidateQueries({ queryKey: ["rbac", "user-profiles"] });
      qc.invalidateQueries({ queryKey: ["rbac", "user-role-assignments"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const activeRoles = (rolesQ.data ?? []).filter((r) => r.actif);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Enregistrer" : "Créer l'utilisateur"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom complet *</Label>
            <Input
              value={form.nom_complet}
              onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Prénom</Label>
            <Input
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              disabled={isEdit}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fonction</Label>
            <Input
              value={form.fonction}
              onChange={(e) => setForm({ ...form, fonction: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Département</Label>
            <Input
              value={form.departement}
              onChange={(e) => setForm({ ...form, departement: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
            <div>
              <Label>Compte actif</Label>
              <p className="text-xs text-muted-foreground">
                Un compte inactif ne peut plus se connecter.
              </p>
            </div>
            <Switch checked={form.actif} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
          </div>
        </section>
        <Separator />
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">
              {isEdit ? "Changer le mot de passe (optionnel)" : "Mot de passe *"}
            </h3>
            <p className="text-xs text-muted-foreground">Minimum 8 caractères.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Confirmer"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
        </section>
        <Separator />
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Rôles attribués</h3>
            <p className="text-xs text-muted-foreground">
              Les permissions sont héritées des rôles. La matrice de permissions se gère dans
              l'onglet « Console » ou « Gérer les rôles ».
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {activeRoles.map((r) => (
              <label
                key={r.role_id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
              >
                <Checkbox
                  checked={form.role_ids.has(r.role_id)}
                  onCheckedChange={(v) => toggleRole(r.role_id, !!v)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.libelle}</div>
                  <div className="text-xs text-muted-foreground">{r.code}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>
    </ResponsiveDialog>
  );
}
