import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/comptabilite/nouvelle")({
  component: NouvelleEcriturePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type LigneForm = {
  compte: string;
  compte_libelle: string;
  debit: number;
  credit: number;
};

const emptyLigne = (): LigneForm => ({ compte: "", compte_libelle: "", debit: 0, credit: 0 });

const JOURNAUX = [
  { value: "VT", label: "VT — Ventes" },
  { value: "AC", label: "AC — Achats" },
  { value: "BQ", label: "BQ — Banque" },
  { value: "CA", label: "CA — Caisse" },
  { value: "OD", label: "OD — Opérations diverses" },
  { value: "PA", label: "PA — Paie" },
];

function NouvelleEcriturePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [dateEcriture, setDateEcriture] = useState(today);
  const [journal, setJournal] = useState("OD");
  const [reference, setReference] = useState("");
  const [libelle, setLibelle] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([emptyLigne(), emptyLigne()]);

  const totals = useMemo(() => {
    const d = lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit: d, credit: c, diff: d - c, balanced: d === c && d > 0 };
  }, [lignes]);

  const updateLigne = (i: number, patch: Partial<LigneForm>) => {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLigne = () => setLignes((ls) => [...ls, emptyLigne()]);
  const removeLigne = (i: number) =>
    setLignes((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const save = useMutation({
    mutationFn: async () => {
      if (!libelle.trim()) throw new Error("Libellé requis");
      if (!totals.balanced) throw new Error("L'écriture doit être équilibrée (débit = crédit).");
      const valid = lignes.filter((l) => l.compte.trim() && (l.debit > 0 || l.credit > 0));
      if (valid.length < 2) throw new Error("Au moins 2 lignes valides sont requises.");

      const ref = reference.trim() || `${journal}-${Date.now().toString().slice(-6)}`;
      const { data: ec, error: e1 } = await supabase
        .from("ecritures_comptables")
        .insert({
          date_ecriture: dateEcriture,
          journal,
          reference: ref,
          libelle: libelle.trim(),
          montant_total: totals.debit,
          source_type: "manuel",
        })
        .select()
        .single();
      if (e1) throw e1;

      const rows = valid.map((l) => ({
        ecriture_id: ec.ecriture_id,
        compte: l.compte.trim(),
        compte_libelle: l.compte_libelle.trim() || l.compte.trim(),
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }));
      const { error: e2 } = await supabase.from("ecriture_lignes").insert(rows);
      if (e2) throw e2;
      return ec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comptabilite"] });
      toast.success("Écriture enregistrée");
      navigate({ to: "/comptabilite" });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button aria-label="Retour" asChild variant="ghost" size="icon">
          <Link to="/comptabilite">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="ds-page-title">Nouvelle écriture comptable</h1>
          <p className="text-sm text-muted-foreground">Saisie manuelle — SYSCOHADA</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En-tête</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={dateEcriture}
              onChange={(e) => setDateEcriture(e.target.value)}
            />
          </div>
          <div>
            <Label>Journal *</Label>
            <Select value={journal} onValueChange={setJournal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOURNAUX.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pièce / Référence</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Auto si vide"
            />
          </div>
          <div className="md:col-span-4">
            <Label>Libellé *</Label>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lignes de l'écriture</CardTitle>
          <Button size="sm" variant="outline" onClick={addLigne}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Compte</TableHead>
                <TableHead>Intitulé</TableHead>
                <TableHead className="w-40 text-right">Débit</TableHead>
                <TableHead className="w-40 text-right">Crédit</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      className="font-mono"
                      value={l.compte}
                      onChange={(e) => updateLigne(i, { compte: e.target.value })}
                      placeholder="411000"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={l.compte_libelle}
                      onChange={(e) => updateLigne(i, { compte_libelle: e.target.value })}
                      placeholder="Clients"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="text-right"
                      value={l.debit || ""}
                      onChange={(e) =>
                        updateLigne(i, { debit: Number(e.target.value) || 0, credit: 0 })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="text-right"
                      value={l.credit || ""}
                      onChange={(e) =>
                        updateLigne(i, { credit: Number(e.target.value) || 0, debit: 0 })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLigne(i)}
                      disabled={lignes.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap justify-end gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Total débit : </span>
              <span className="font-semibold">{formatFCFA(totals.debit)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total crédit : </span>
              <span className="font-semibold">{formatFCFA(totals.credit)}</span>
            </div>
            <div
              className={
                totals.balanced
                  ? "font-semibold text-success"
                  : "font-semibold text-destructive"
              }
            >
              {totals.balanced ? "Équilibré" : `Écart : ${formatFCFA(Math.abs(totals.diff))}`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-40 flex justify-end gap-2 border-t bg-background/95 p-3 backdrop-blur">
        <Button variant="outline" onClick={() => navigate({ to: "/comptabilite" })}>
          <X className="mr-2 h-4 w-4" /> Annuler
        </Button>
        <Button
          disabled={save.isPending || !totals.balanced || !libelle.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
