import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  Copy,
  Download,
  FileEdit,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  secCreateRole,
  secDeleteRole,
  secDuplicateRole,
  secGetMatrix,
  secSetRolePerms,
  secSetRoleStatut,
  secUpdateRole,
} from "@/lib/security-roles.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RoleRow = {
  code: string;
  label: string;
  description: string | null;
  is_system: boolean;
  sort: number | null;
  statut: "brouillon" | "actif" | "archive";
  valide_at: string | null;
  users_count: number;
};

type PermRow = {
  code: string;
  action: string;
  label: string | null;
  resource_code: string;
  resource_label: string;
  module_code: string;
  module_label: string;
};

const STATUT_META: Record<RoleRow["statut"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  actif: { label: "Actif", variant: "default" },
  brouillon: { label: "Brouillon", variant: "secondary" },
  archive: { label: "Archivé", variant: "outline" },
};

export default function RolesAdmin() {
  const qc = useQueryClient();
  const getMatrix = useServerFn(secGetMatrix);
  const setPerms = useServerFn(secSetRolePerms);
  const createRole = useServerFn(secCreateRole);
  const updateRole = useServerFn(secUpdateRole);
  const setStatut = useServerFn(secSetRoleStatut);
  const duplicateRole = useServerFn(secDuplicateRole);
  const deleteRole = useServerFn(secDeleteRole);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sec-matrix"],
    queryFn: () => getMatrix(),
    staleTime: 30_000,
  });

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<RoleRow | null>(null);
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sec-matrix"] });

  const roles = (data?.roles ?? []) as RoleRow[];
  const permissions = (data?.permissions ?? []) as PermRow[];
  const grants = useMemo(() => new Set(data?.grants ?? []), [data?.grants]);

  const visibleRoles = useMemo(
    () => roles.filter((r) => r.statut !== "archive"),
    [roles],
  );

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(
      (r) =>
        (statutFilter === "all" || r.statut === statutFilter) &&
        (!q || r.label.toLowerCase().includes(q) || r.code.includes(q)),
    );
  }, [roles, search, statutFilter]);

  const filteredPerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permissions.filter(
      (p) =>
        (moduleFilter === "all" || p.module_code === moduleFilter) &&
        (!q ||
          p.code.toLowerCase().includes(q) ||
          (p.label ?? "").toLowerCase().includes(q) ||
          p.resource_label.toLowerCase().includes(q)),
    );
  }, [permissions, moduleFilter, search]);

  const groupedPerms = useMemo(() => {
    const map = new Map<string, { label: string; items: PermRow[] }>();
    for (const p of filteredPerms) {
      const g = map.get(p.module_code) ?? { label: p.module_label, items: [] };
      g.items.push(p);
      map.set(p.module_code, g);
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filteredPerms]);

  const permMutation = useMutation({
    mutationFn: (v: { role_code: string; perm_codes: string[]; granted: boolean }) =>
      setPerms({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingCell(null),
  });

  const toggleCell = (roleCode: string, permCode: string, granted: boolean) => {
    setPendingCell(`${roleCode}::${permCode}`);
    permMutation.mutate({ role_code: roleCode, perm_codes: [permCode], granted });
  };

  const toggleBulk = (roleCode: string, permCodes: string[], granted: boolean) => {
    if (permCodes.length === 0) return;
    permMutation.mutate(
      { role_code: roleCode, perm_codes: permCodes, granted },
      {
        onSuccess: () =>
          toast.success(
            `${permCodes.length} permission(s) ${granted ? "accordée(s)" : "retirée(s)"}`,
          ),
      },
    );
  };

  const statutMutation = useMutation({
    mutationFn: (v: { code: string; statut: RoleRow["statut"] }) => setStatut({ data: v }),
    onSuccess: () => {
      toast.success("Statut du rôle mis à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deleteRole({ data: { code } }),
    onSuccess: () => {
      toast.success("Rôle supprimé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const header = ["module", "permission", "libelle", ...visibleRoles.map((r) => r.code)];
    const lines = [header.join(";")];
    for (const p of filteredPerms) {
      lines.push(
        [
          p.module_label,
          p.code,
          (p.label ?? "").replace(/;/g, ","),
          ...visibleRoles.map((r) =>
            r.code === "super_admin" || grants.has(`${r.code}::${p.code}`) ? "X" : "",
          ),
        ].join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matrice-permissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rôles &amp; permissions</h1>
          <p className="text-sm text-muted-foreground">
            Moteur de sécurité central — {roles.length} rôles, {permissions.length} permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau rôle
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher un rôle ou une permission…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Tous les modules</SelectItem>
            {(data?.modules ?? []).map((m) => (
              <SelectItem key={m.code} value={m.code}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="matrice">
        <TabsList>
          <TabsTrigger value="matrice">Matrice</TabsTrigger>
          <TabsTrigger value="roles">Rôles</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- MATRICE */}
        <TabsContent value="matrice" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-20 bg-background shadow-sm">
                      <tr>
                        <th className="sticky left-0 z-30 min-w-[320px] bg-background p-3 text-left font-medium">
                          Permission
                        </th>
                        {visibleRoles.map((r) => (
                          <th key={r.code} className="min-w-[110px] p-2 text-center align-bottom">
                            <div className="text-xs font-medium">{r.label}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.users_count} util.
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedPerms.map(([moduleCode, group]) => {
                        const codes = group.items.map((p) => p.code);
                        return (
                          <Fragment key={moduleCode}>
                            <tr className="bg-muted/60">
                              <td className="sticky left-0 z-10 bg-muted/60 p-2 text-xs font-semibold uppercase tracking-wide">
                                {group.label} ({group.items.length})
                              </td>
                              {visibleRoles.map((r) => (
                                <td key={r.code} className="p-1 text-center">
                                  {r.code === "super_admin" ? (
                                    <span className="text-[10px] text-muted-foreground">tout</span>
                                  ) : (
                                    <div className="flex justify-center gap-1">
                                      <button
                                        type="button"
                                        title="Tout accorder"
                                        className="rounded px-1 text-[10px] text-primary hover:bg-primary/10"
                                        onClick={() => toggleBulk(r.code, codes, true)}
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        title="Tout retirer"
                                        className="rounded px-1 text-[10px] text-destructive hover:bg-destructive/10"
                                        onClick={() => toggleBulk(r.code, codes, false)}
                                      >
                                        −
                                      </button>
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                            {group.items.map((p) => (
                              <tr key={p.code} className="border-t hover:bg-muted/30">
                                <td className="sticky left-0 z-10 bg-background p-2">
                                  <div className="font-medium">{p.label ?? p.code}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {p.resource_label} · {p.action}
                                  </div>
                                </td>
                                {visibleRoles.map((r) => {
                                  const key = `${r.code}::${p.code}`;
                                  const isSuper = r.code === "super_admin";
                                  return (
                                    <td key={r.code} className="p-1 text-center">
                                      <Checkbox
                                        checked={isSuper || grants.has(key)}
                                        disabled={isSuper || pendingCell === key}
                                        onCheckedChange={(v) =>
                                          toggleCell(r.code, p.code, v === true)
                                        }
                                        aria-label={`${p.code} pour ${r.label}`}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                      {groupedPerms.length === 0 && (
                        <tr>
                          <td
                            colSpan={visibleRoles.length + 1}
                            className="p-8 text-center text-muted-foreground"
                          >
                            Aucune permission ne correspond aux filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------ ROLES */}
        <TabsContent value="roles" className="mt-4 space-y-3">
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="actif">Actifs</SelectItem>
              <SelectItem value="brouillon">Brouillons</SelectItem>
              <SelectItem value="archive">Archivés</SelectItem>
            </SelectContent>
          </Select>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-center">Permissions</TableHead>
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((r) => {
                    const permCount =
                      r.code === "super_admin"
                        ? permissions.length
                        : permissions.filter((p) => grants.has(`${r.code}::${p.code}`)).length;
                    return (
                      <TableRow key={r.code}>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            {r.is_system && <ShieldCheck className="h-4 w-4 text-primary" />}
                            {r.label}
                          </div>
                          {r.description && (
                            <div className="text-xs text-muted-foreground">{r.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="text-center">{permCount}</TableCell>
                        <TableCell className="text-center">{r.users_count}</TableCell>
                        <TableCell>
                          <Badge variant={STATUT_META[r.statut].variant}>
                            {STATUT_META[r.statut].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Modifier"
                              onClick={() => setEditing(r)}
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Dupliquer"
                              onClick={() => setDuplicating(r)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {r.statut !== "actif" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Valider / activer"
                                onClick={() =>
                                  statutMutation.mutate({ code: r.code, statut: "actif" })
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Archiver"
                                disabled={r.code === "super_admin"}
                                onClick={() =>
                                  statutMutation.mutate({ code: r.code, statut: "archive" })
                                }
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Supprimer"
                              disabled={r.is_system}
                              onClick={() => {
                                if (confirm(`Supprimer définitivement le rôle « ${r.label} » ?`)) {
                                  deleteMutation.mutate(r.code);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RoleFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nouveau rôle"
        roles={roles}
        onSubmit={async (v) => {
          await createRole({ data: v });
          toast.success("Rôle créé");
          invalidate();
        }}
      />

      <RoleFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Modifier le rôle"
        initial={editing ?? undefined}
        editMode
        roles={roles}
        onSubmit={async (v) => {
          await updateRole({
            data: { code: editing!.code, label: v.label, description: v.description },
          });
          toast.success("Rôle mis à jour");
          setEditing(null);
          invalidate();
        }}
      />

      <DuplicateDialog
        role={duplicating}
        onClose={() => setDuplicating(null)}
        onSubmit={async (v) => {
          const res = await duplicateRole({ data: v });
          toast.success(`Rôle dupliqué (${res.perms} permissions copiées)`);
          setDuplicating(null);
          invalidate();
        }}
      />
    </div>
  );
}

function RoleFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  editMode,
  roles,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: RoleRow;
  editMode?: boolean;
  roles: RoleRow[];
  onSubmit: (v: {
    code: string;
    label: string;
    description: string | null;
    statut: RoleRow["statut"];
    copy_from: string | null;
  }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [copyFrom, setCopyFrom] = useState("none");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode(initial?.code ?? "");
    setLabel(initial?.label ?? "");
    setDescription(initial?.description ?? "");
    setCopyFrom("none");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Les rôles créés démarrent en brouillon : validez-les pour les rendre attribuables.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!editMode && (
            <div>
              <Label>Code technique</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="responsable_qualite"
              />
            </div>
          )}
          <div>
            <Label>Libellé</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {!editMode && (
            <div>
              <Label>Copier les permissions d'un rôle</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">Partir de zéro</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={busy || label.trim().length < 2 || (!editMode && code.trim().length < 2)}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit({
                  code: code.trim(),
                  label: label.trim(),
                  description: description.trim() || null,
                  statut: "brouillon",
                  copy_from: copyFrom === "none" ? null : copyFrom,
                });
                onOpenChange(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({
  role,
  onClose,
  onSubmit,
}: {
  role: RoleRow | null;
  onClose: () => void;
  onSubmit: (v: { source_code: string; code: string; label: string }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={!!role}
      onOpenChange={(o) => {
        if (o && role) {
          setCode(`${role.code}_copie`);
          setLabel(`${role.label} (copie)`);
        }
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dupliquer « {role?.label} »</DialogTitle>
          <DialogDescription>
            Toutes les permissions du rôle source sont copiées dans le nouveau rôle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Code technique</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <Label>Libellé</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={busy || !role || code.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit({
                  source_code: role!.code,
                  code: code.trim(),
                  label: label.trim(),
                });
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
