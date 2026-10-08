import { createFileRoute } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sliders, Plus, Save, Trash2 } from "lucide-react";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/approbation-seuils")({
  component: SeuilsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Seuil = {
  id: string;
  module: string;
  type_operation: string;
  seuil_urgent: number;
  seuil_critique: number;
  sla_normal_heures: number;
  sla_urgent_heures: number;
  sla_critique_heures: number;
  actif: boolean;
  description: string | null;
  updated_at: string;
};

const MODULES = [
  "paiements", "couts_logistiques", "achats", "transferts",
  "bulletins_paie", "retours", "annulations",
];

function fmt(n: number) {
  return formatFCFA(n, false);
}

function SeuilsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Seuil | null>(null);
  const [isNew, setIsNew] = useState(false);

  const { data: seuils = [], isLoading } = useQuery({
    queryKey: ["approbation-seuils"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approbation_seuils")
        .select("*")
        .order("module")
        .order("type_operation");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (s: Partial<Seuil> & { id?: string }) => {
      if (s.id) {
        const { error } = await supabase.from("approbation_seuils")
          .update({
            seuil_urgent: s.seuil_urgent,
            seuil_critique: s.seuil_critique,
            sla_normal_heures: s.sla_normal_heures,
            sla_urgent_heures: s.sla_urgent_heures,
            sla_critique_heures: s.sla_critique_heures,
            actif: s.actif,
            description: s.description,
          })
          .eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("approbation_seuils" as any).insert({
          module: s.module,
          type_operation: s.type_operation || "default",
          seuil_urgent: s.seuil_urgent ?? 250000,
          seuil_critique: s.seuil_critique ?? 1000000,
          sla_normal_heures: s.sla_normal_heures ?? 72,
          sla_urgent_heures: s.sla_urgent_heures ?? 48,
          sla_critique_heures: s.sla_critique_heures ?? 24,
          actif: s.actif ?? true,
          description: s.description,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Seuil enregistré");
      qc.invalidateQueries({ queryKey: ["approbation-seuils"] });
      setEditing(null); setIsNew(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approbation_seuils" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seuil supprimé");
      qc.invalidateQueries({ queryKey: ["approbation-seuils"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActif = (s: Seuil) => saveMut.mutate({ ...s, actif: !s.actif });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sliders className="w-6 h-6 text-primary" />
          <div>
            <h1 className="ds-page-title">Seuils d'approbation</h1>
            <p className="text-sm text-muted-foreground">
              Configuration des niveaux d'urgence et SLA par module métier
            </p>
          </div>
        </div>
        <Button onClick={() => { setIsNew(true); setEditing({
          id: "", module: MODULES[0], type_operation: "default",
          seuil_urgent: 250000, seuil_critique: 1000000,
          sla_normal_heures: 72, sla_urgent_heures: 48, sla_critique_heures: 24,
          actif: true, description: "", updated_at: "",
        }); }}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau seuil
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Règles actives</CardTitle>
          <CardDescription>
            Les montants déclenchent le niveau d'urgence. Le SLA (heures) définit la date limite d'approbation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Seuil urgent</TableHead>
                  <TableHead className="text-right">Seuil critique</TableHead>
                  <TableHead className="text-center">SLA (N/U/C)</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seuils.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Badge variant="outline">{s.module}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.type_operation}</TableCell>
                    <TableCell className="text-right">{fmt(s.seuil_urgent)}</TableCell>
                    <TableCell className="text-right">{fmt(s.seuil_critique)}</TableCell>
                    <TableCell className="text-center text-xs">
                      {s.sla_normal_heures}h / {s.sla_urgent_heures}h / {s.sla_critique_heures}h
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={s.actif} onCheckedChange={() => toggleActif(s)} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => { setIsNew(false); setEditing(s); }}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Supprimer le seuil ${s.module}/${s.type_operation} ?`))
                          deleteMut.mutate(s.id);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {seuils.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Aucun seuil configuré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setIsNew(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nouveau seuil" : "Modifier le seuil"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={editing.module}
                  onChange={(e) => setEditing({ ...editing, module: e.target.value })}
                  disabled={!isNew}
                >
                  {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Type d'opération</Label>
                <Input
                  value={editing.type_operation}
                  onChange={(e) => setEditing({ ...editing, type_operation: e.target.value })}
                  disabled={!isNew}
                />
              </div>
              <div className="space-y-2">
                <Label>Seuil urgent (FCFA)</Label>
                <Input type="number" value={editing.seuil_urgent}
                  onChange={(e) => setEditing({ ...editing, seuil_urgent: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Seuil critique (FCFA)</Label>
                <Input type="number" value={editing.seuil_critique}
                  onChange={(e) => setEditing({ ...editing, seuil_critique: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>SLA normal (heures)</Label>
                <Input type="number" value={editing.sla_normal_heures}
                  onChange={(e) => setEditing({ ...editing, sla_normal_heures: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>SLA urgent (heures)</Label>
                <Input type="number" value={editing.sla_urgent_heures}
                  onChange={(e) => setEditing({ ...editing, sla_urgent_heures: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>SLA critique (heures)</Label>
                <Input type="number" value={editing.sla_critique_heures}
                  onChange={(e) => setEditing({ ...editing, sla_critique_heures: Number(e.target.value) })} />
              </div>
              <div className="space-y-2 flex items-end gap-3">
                <Switch checked={editing.actif}
                  onCheckedChange={(v) => setEditing({ ...editing, actif: v })} />
                <Label>Règle active</Label>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Input value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}>Annuler</Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending}
            >
              <Save className="w-4 h-4 mr-2" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
