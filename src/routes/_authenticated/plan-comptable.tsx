import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, ListTree, Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { getBalance, getPlanComptable, type ComptePlan } from "@/lib/compta-api";
import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/plan-comptable")({
  component: PlanComptablePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

/** Libellés officiels des classes du plan SYSCOHADA. */
const CLASSES: Record<number, string> = {
  1: "Ressources durables",
  2: "Actif immobilisé",
  3: "Stocks et en-cours",
  4: "Tiers",
  5: "Trésorerie",
  6: "Charges",
  7: "Produits",
  8: "Résultats",
  9: "Comptabilité analytique",
};

const TYPES: Record<string, string> = {
  actif: "Actif",
  passif: "Passif",
  charge: "Charge",
  produit: "Produit",
};

function classeLabel(classe: number) {
  return CLASSES[classe] ?? "Classe non classée";
}

function typeLabel(type: string) {
  return TYPES[type] ?? type;
}

function PlanComptablePage() {
  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState<string>("all");

  const { data: comptes = [], isLoading } = useQuery({
    queryKey: ["plan-comptable"],
    queryFn: getPlanComptable,
  });

  // Solde cumulé de chaque compte, pour voir ceux qui servent réellement.
  const { data: balance = [] } = useQuery({
    queryKey: ["balance", "", ""],
    queryFn: () => getBalance(),
  });

  const soldes = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of balance) map.set(r.compte.trim(), r.solde);
    return map;
  }, [balance]);

  const classesDisponibles = useMemo(
    () => Array.from(new Set(comptes.map((c) => c.classe))).sort((a, b) => a - b),
    [comptes],
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return comptes.filter((c) => {
      if (classe !== "all" && String(c.classe) !== classe) return false;
      if (!q) return true;
      return (
        c.numero.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q)
      );
    });
  }, [comptes, recherche, classe]);

  const groupes = useMemo(() => {
    const map = new Map<number, ComptePlan[]>();
    for (const c of filtres) {
      const list = map.get(c.classe) ?? [];
      list.push(c);
      map.set(c.classe, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cl, list]) => ({
        classe: cl,
        comptes: list.sort((a, b) => a.numero.localeCompare(b.numero)),
      }));
  }, [filtres]);

  const horsPlan = useMemo(() => {
    const dansLePlan = new Set(comptes.map((c) => c.numero.trim()));
    return balance
      .filter((r) => !dansLePlan.has(r.compte.trim()))
      .sort((a, b) => a.compte.localeCompare(b.compte));
  }, [comptes, balance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <ListTree className="h-6 w-6" /> Plan comptable
          </h1>
          <p className="text-sm text-muted-foreground">
            Référentiel SYSCOHADA — {comptes.length} comptes, {classesDisponibles.length} classes
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!filtres.length}
          onClick={() =>
            exportCsv(
              "plan-comptable",
              ["Classe", "Compte", "Libellé", "Type", "Solde"],
              filtres.map((c) => [
                `${c.classe} — ${classeLabel(c.classe)}`,
                c.numero,
                c.libelle,
                typeLabel(c.type),
                soldes.get(c.numero.trim()) ?? 0,
              ]),
              {
                pageTitle: "PLAN COMPTABLE SYSCOHADA",
                summary: [
                  { label: "Nombre de comptes", value: String(filtres.length) },
                  {
                    label: "Classes",
                    value: Array.from(new Set(filtres.map((c) => c.classe)))
                      .sort((a, b) => a - b)
                      .join(", "),
                  },
                ],
              },
            )
          }
        >
          <Download className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="plan-recherche">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="plan-recherche"
                className="pl-9"
                placeholder="Numéro ou libellé du compte"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[220px]">
            <Label>Classe</Label>
            <Select value={classe} onValueChange={setClasse}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classesDisponibles.map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    Classe {c} — {classeLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Solde cumulé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : groupes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun compte ne correspond à la recherche
                    </TableCell>
                  </TableRow>
                ) : (
                  groupes.map((g) => (
                    <PlanClasse key={g.classe} classe={g.classe} comptes={g.comptes} soldes={soldes} />
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      {horsPlan.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {horsPlan.length} compte(s) utilisés dans les écritures ne figurent pas au plan :{" "}
          {horsPlan
            .slice(0, 8)
            .map((r) => `${r.compte} (${r.compte_libelle})`)
            .join(", ")}
          {horsPlan.length > 8 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function PlanClasse({
  classe,
  comptes,
  soldes,
}: {
  classe: number;
  comptes: ComptePlan[];
  soldes: Map<string, number>;
}) {
  return (
    <>
      <TableRow className="bg-muted/60">
        <TableCell colSpan={4} className="font-semibold">
          Classe {classe} — {classeLabel(classe)}
        </TableCell>
      </TableRow>
      {comptes.map((c) => {
        const solde = soldes.get(c.numero.trim());
        return (
          <TableRow key={c.compte_id}>
            <TableCell className="font-mono text-xs">{c.numero}</TableCell>
            <TableCell>{c.libelle}</TableCell>
            <TableCell className="text-muted-foreground">{typeLabel(c.type)}</TableCell>
            <TableCell className="text-right">
              {solde === undefined ? (
                <span className="text-muted-foreground">Aucun mouvement</span>
              ) : (
                <span className="font-medium">{formatFCFA(solde)}</span>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
