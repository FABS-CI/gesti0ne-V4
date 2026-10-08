import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, RefreshCcw, Search, Shield, Trash2, Users, Copy } from "lucide-react";
import { ScopesTabV3 } from "@/components/roles-permissions/ScopesTabV3";
import { AuditTabV3 } from "@/components/roles-permissions/AuditTabV3";

export const Route = createFileRoute("/_authenticated/admin/roles-v3")({
  component: RolesV3Page,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  head: () => ({
    meta: [
      { title: "Sécurité v3 — Rôles & Permissions | ERP FABS-CI" },
      { name: "description", content: "Console d'administration du moteur de sécurité v3 : rôles, matrice de permissions par module et affectations utilisateurs." },
      { property: "og:title", content: "Sécurité v3 — Rôles & Permissions" },
      { property: "og:description", content: "Gérez les rôles, la matrice module × action et les affectations utilisateurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Module = { code: string; label: string; groupe: string | null; ordre: number | null; actif: boolean | null };
type Action = { code: string; label: string; ordre: number | null };
type Perm = { code: string; module_code: string; action_code: string; label: string | null; sensible: boolean | null };
type Role = {
  code: string; label: string; description: string | null; statut: string | null;
  portee_globale: boolean | null; systeme: boolean | null; ordre: number | null;
};
type RolePerm = { role_code: string; perm_code: string };
type UserRole = { user_id: string; role_code: string };
type Profile = { id: string; email: string | null; nom: string | null; prenom: string | null };

const emptyForm = { code: "", label: "", description: "", portee_globale: false, statut: "actif" };

function RolesV3Page() {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [isEdit, setIsEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, p, r, rp, ur, pr] = await Promise.all([
        supabase.from("rbac3_modules").select("*").order("ordre"),
        supabase.from("rbac3_actions").select("*").order("ordre"),
        supabase.from("rbac3_permissions").select("*"),
        supabase.from("rbac3_roles").select("*").order("ordre"),
        supabase.from("rbac3_role_permissions").select("*"),
        supabase.from("rbac3_user_roles").select("*"),
        supabase.from("profiles").select("id, email, nom, prenom"),
      ]);
      const err = [m, a, p, r, rp, ur, pr].find((x) => x.error)?.error;
      if (err) throw err;
      setModules((m.data ?? []) as Module[]);
      setActions((a.data ?? []) as Action[]);
      setPerms((p.data ?? []) as Perm[]);
      setRoles((r.data ?? []) as Role[]);
      setRolePerms((rp.data ?? []) as RolePerm[]);
      setUserRoles((ur.data ?? []) as UserRole[]);
      setProfiles((pr.data ?? []) as Profile[]);
      setSelectedRole((cur) => cur ?? ((r.data ?? [])[0] as Role | undefined)?.code ?? null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const permByKey = useMemo(() => {
    const map = new Map<string, Perm>();
    perms.forEach((p) => map.set(`${p.module_code}.${p.action_code}`, p));
    return map;
  }, [perms]);

  const grantedSet = useMemo(() => {
    const s = new Set<string>();
    rolePerms.forEach((rp) => { if (rp.role_code === selectedRole) s.add(rp.perm_code); });
    return s;
  }, [rolePerms, selectedRole]);

  const countsByRole = useMemo(() => {
    const m = new Map<string, number>();
    rolePerms.forEach((rp) => m.set(rp.role_code, (m.get(rp.role_code) ?? 0) + 1));
    return m;
  }, [rolePerms]);

  const usersByRole = useMemo(() => {
    const m = new Map<string, number>();
    userRoles.forEach((ur) => m.set(ur.role_code, (m.get(ur.role_code) ?? 0) + 1));
    return m;
  }, [userRoles]);

  const filteredModules = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = modules.filter((mo) => mo.actif !== false);
    if (!s) return list;
    return list.filter((mo) => mo.code.includes(s) || (mo.label ?? "").toLowerCase().includes(s));
  }, [modules, search]);

  const groupedModules = useMemo(() => {
    const g = new Map<string, Module[]>();
    filteredModules.forEach((mo) => {
      const key = mo.groupe ?? "Autres";
      g.set(key, [...(g.get(key) ?? []), mo]);
    });
    return Array.from(g.entries());
  }, [filteredModules]);

  const isFrozen = selectedRole === "super_admin";

  const togglePerm = async (permCode: string, next: boolean) => {
    if (!selectedRole || isFrozen) return;
    setRolePerms((cur) => next
      ? [...cur, { role_code: selectedRole, perm_code: permCode }]
      : cur.filter((rp) => !(rp.role_code === selectedRole && rp.perm_code === permCode)));
    const { error } = await supabase.rpc("rbac3_perm_set", {
      _role_code: selectedRole, _perm_code: permCode, _granted: next,
    });
    if (error) { toast.error(friendlyError(error)); void reload(); }
  };

  const toggleModuleRow = async (moduleCode: string, next: boolean) => {
    if (!selectedRole || isFrozen) return;
    const codes = perms.filter((p) => p.module_code === moduleCode).map((p) => p.code);
    setRolePerms((cur) => next
      ? [...cur, ...codes.map((c) => ({ role_code: selectedRole, perm_code: c }))]
      : cur.filter((rp) => !(rp.role_code === selectedRole && codes.includes(rp.perm_code))));
    const { error } = await supabase.rpc("rbac3_perm_bulk_set", {
      _role_code: selectedRole, _perm_codes: codes, _granted: next,
    });
    if (error) toast.error(friendlyError(error));
    void reload();
  };

  const copyFrom = async (source: string) => {
    if (!selectedRole || isFrozen || !source) return;
    const { error } = await supabase.rpc("rbac3_role_copy_perms", { _source: source, _target: selectedRole });
    if (error) toast.error(friendlyError(error));
    else toast.success("Droits copiés");
    void reload();
  };

  const saveRole = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("rbac3_role_upsert", {
      _code: form.code,
      _label: form.label,
      _description: form.description || undefined,
      _portee_globale: form.portee_globale,
      _statut: form.statut,
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(isEdit ? "Rôle mis à jour" : "Rôle créé");
    setDialogOpen(false);
    void reload();
  };

  const removeRole = async (code: string) => {
    const { error } = await supabase.rpc("rbac3_role_delete", { _code: code });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Rôle supprimé");
    if (selectedRole === code) setSelectedRole(null);
    void reload();
  };

  const toggleUserRole = async (userId: string, roleCode: string, next: boolean) => {
    setUserRoles((cur) => next
      ? [...cur, { user_id: userId, role_code: roleCode }]
      : cur.filter((ur) => !(ur.user_id === userId && ur.role_code === roleCode)));
    const { error } = await supabase.rpc("rbac3_user_role_set", {
      _user_id: userId, _role_code: roleCode, _granted: next,
    });
    if (error) { toast.error(friendlyError(error)); void reload(); }
  };

  const filteredProfiles = useMemo(() => {
    const s = userSearch.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) =>
      `${p.prenom ?? ""} ${p.nom ?? ""} ${p.email ?? ""}`.toLowerCase().includes(s));
  }, [profiles, userSearch]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Sécurité — Moteur v3
          </h1>
          <p className="text-sm text-muted-foreground">
            Rôles, matrice module × action et affectations utilisateurs (source de vérité des règles d'accès).
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Recharger
        </Button>
      </header>

      <Tabs defaultValue="matrice">
        <TabsList>
          <TabsTrigger value="matrice">Matrice</TabsTrigger>
          <TabsTrigger value="roles">Rôles ({roles.length})</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs ({profiles.length})</TabsTrigger>
          <TabsTrigger value="scopes">Périmètres</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="scopes" className="mt-4">
          <ScopesTabV3 profiles={profiles} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTabV3 />
        </TabsContent>


        {/* ── Matrice ─────────────────────────────────────────── */}
        <TabsContent value="matrice" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <Card className="p-2">
              <ScrollArea className="h-[65vh]">
                <div className="space-y-1 pr-2">
                  {roles.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => setSelectedRole(r.code)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        selectedRole === r.code ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.label}</span>
                        <Badge variant="secondary">{countsByRole.get(r.code) ?? 0}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{r.code}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Rechercher un module…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {selectedRole && !isFrozen && (
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    defaultValue=""
                    onChange={(e) => { void copyFrom(e.target.value); e.currentTarget.value = ""; }}
                  >
                    <option value="">Copier les droits depuis…</option>
                    {roles.filter((r) => r.code !== selectedRole).map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                )}
                {isFrozen && <Badge variant="outline"><Copy className="mr-1 h-3 w-3" />Droits figés (accès total)</Badge>}
              </div>

              <ScrollArea className="h-[58vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      <th className="w-56 py-2 text-left font-medium">Module</th>
                      {actions.map((a) => (
                        <th key={a.code} className="px-1 py-2 text-center text-xs font-medium">{a.label}</th>
                      ))}
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupedModules.map(([groupe, mods]) => (
                      <Fragment key={`g-${groupe}`}>
                        <tr>
                          <td colSpan={actions.length + 2} className="pt-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                            {groupe}
                          </td>
                        </tr>
                        {mods.map((mo) => {
                          const rowCodes = perms.filter((p) => p.module_code === mo.code).map((p) => p.code);
                          const all = rowCodes.length > 0 && rowCodes.every((c) => grantedSet.has(c));
                          return (
                            <tr key={mo.code} className="border-t">
                              <td className="py-2">
                                <div>{mo.label}</div>
                                <div className="text-xs text-muted-foreground">{mo.code}</div>
                              </td>
                              {actions.map((a) => {
                                const perm = permByKey.get(`${mo.code}.${a.code}`);
                                return (
                                  <td key={a.code} className="px-1 py-2 text-center">
                                    {perm ? (
                                      <Checkbox
                                        checked={grantedSet.has(perm.code)}
                                        disabled={!selectedRole || isFrozen}
                                        onCheckedChange={(v) => void togglePerm(perm.code, v === true)}
                                      />
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-1 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!selectedRole || isFrozen}
                                  onClick={() => void toggleModuleRow(mo.code, !all)}
                                >
                                  {all ? "Tout ôter" : "Tout"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>

        {/* ── Rôles ───────────────────────────────────────────── */}
        <TabsContent value="roles" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setForm(emptyForm); setIsEdit(false); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau rôle
            </Button>
          </div>
          <Card className="divide-y">
            {roles.map((r) => (
              <div key={r.code} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {r.label}
                    {r.systeme && <Badge variant="secondary">Système</Badge>}
                    {r.portee_globale && <Badge variant="outline">Portée globale</Badge>}
                    {r.statut !== "actif" && <Badge variant="destructive">{r.statut}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.code} · {countsByRole.get(r.code) ?? 0} droits · {usersByRole.get(r.code) ?? 0} utilisateur(s)
                  </div>
                  {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={r.code === "super_admin"}
                    onClick={() => {
                      setForm({
                        code: r.code, label: r.label, description: r.description ?? "",
                        portee_globale: !!r.portee_globale, statut: r.statut ?? "actif",
                      });
                      setIsEdit(true);
                      setDialogOpen(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!r.systeme || r.code === "super_admin"}
                    onClick={() => void removeRole(r.code)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* ── Utilisateurs ────────────────────────────────────── */}
        <TabsContent value="users" className="mt-4">
          <Card className="p-4">
            <div className="relative mb-4 max-w-sm">
              <Users className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Rechercher un utilisateur…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr>
                    <th className="w-64 py-2 text-left font-medium">Utilisateur</th>
                    {roles.map((r) => (
                      <th key={r.code} className="px-1 py-2 text-center text-xs font-medium">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2">
                        <div>{[p.prenom, p.nom].filter(Boolean).join(" ") || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      {roles.map((r) => {
                        const on = userRoles.some((ur) => ur.user_id === p.id && ur.role_code === r.code);
                        return (
                          <td key={r.code} className="px-1 py-2 text-center">
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => void toggleUserRole(p.id, r.code, v === true)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Modifier le rôle" : "Nouveau rôle"}</DialogTitle>
            <DialogDescription>
              Le code du rôle est technique et ne peut plus être modifié après création.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="role-code">Code</Label>
              <Input
                id="role-code"
                value={form.code}
                disabled={isEdit}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="responsable_logistique"
              />
            </div>
            <div>
              <Label htmlFor="role-label">Libellé</Label>
              <Input
                id="role-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Responsable logistique"
              />
            </div>
            <div>
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Portée globale</Label>
                <p className="text-xs text-muted-foreground">Accès à tous les dépôts et services.</p>
              </div>
              <Switch
                checked={form.portee_globale}
                onCheckedChange={(v) => setForm({ ...form, portee_globale: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Rôle actif</Label>
                <p className="text-xs text-muted-foreground">Un rôle inactif n'accorde plus aucun droit.</p>
              </div>
              <Switch
                checked={form.statut === "actif"}
                onCheckedChange={(v) => setForm({ ...form, statut: v ? "actif" : "inactif" })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => void saveRole()} disabled={busy || !form.code || !form.label}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
