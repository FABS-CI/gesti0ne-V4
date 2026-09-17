import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users2,
  Search,
  Plus,
  Download,
  Pencil,
  Trash2,
  ListOrdered,
  FileText,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/rbac/Can";

import {
  listEmployes,
  deleteEmploye,
  hardDeleteEmploye,
  restoreEmploye,
  renumberEmployesMatricules,
  DEPARTEMENT_LABEL,
  type Employe,
} from "@/lib/rh-api";
import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { generateEmployeFichePDF } from "@/lib/pdf/employePdf";
import { describeSupabaseError } from "@/lib/rbac-api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from '@/lib/friendly-error';
export const Route = createFileRoute("/_authenticated/employes/")({
  head: () => authRouteHead("Employés"),
  component: EmployesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function EmployesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [toDelete, setToDelete] = useState<Employe | null>(null);
  const RETENTION_DAYS = 30;

  const { data: employes = [], isLoading } = useQuery({
    queryKey: ["employes", q],
    queryFn: () => listEmployes(q),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ emp, motif }: { emp: Employe; motif: string | null }) => {
      try {
        await hardDeleteEmploye(emp.employe_id, motif);
        return { emp, hard: true as const };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/référenc|referenc|foreign key|violates|dependenc/i.test(msg)) {
          await deleteEmploye(emp.employe_id);
          return { emp, hard: false as const };
        }
        throw err;
      }
    },
    onSuccess: ({ emp, hard }) => {
      queryClient.invalidateQueries({ queryKey: ["employes"] });
      setToDelete(null);
      if (hard) {
        toast.success(`${emp.nom_complet} supprimé définitivement`);
      } else {
        toast.success(`${emp.nom_complet} archivé (référencé ailleurs)`, {
          description: `Restaurable pendant ${RETENTION_DAYS} jours.`,
          duration: 10000,
          action: {
            label: "Annuler",
            onClick: () => restoreMutation.mutate(emp),
          },
        });
      }
    },
    onError: (e: unknown) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (emp: Employe) => restoreEmploye(emp.employe_id, RETENTION_DAYS).then(() => emp),
    onSuccess: (emp) => {
      queryClient.invalidateQueries({ queryKey: ["employes"] });
      toast.success(`${emp.nom_complet} restauré`);
    },
    onError: (e: unknown) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const renumberMutation = useMutation({
    mutationFn: () => renumberEmployesMatricules(),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["employes"] });
      toast.success(`Matricules renumérotés (${count})`);
    },
    onError: (e: unknown) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  function handleExport() {
    exportCsv(
      "employes.csv",
      [
        "Matricule",
        "Nom",
        "Prénom",
        "Poste",
        "Département",
        "Email",
        "Téléphone",
        "Embauche",
        "Salaire",
        "Statut",
      ],
      employes.map((e) => [
        e.matricule,
        e.nom_complet,
        e.prenoms ?? "",
        e.poste ?? "",
        DEPARTEMENT_LABEL[e.departement] ?? e.departement,
        e.email ?? "",
        e.telephone ?? "",
        e.date_embauche,
        String(e.salaire),
        e.actif ? "Actif" : "Inactif",
      ]),
      {
        pageTitle: "LISTE DU PERSONNEL",
        summary: [
          { label: "Effectif total", value: String(employes.length) },
          { label: "Employés actifs", value: String(employes.filter((e) => e.actif).length) },
          {
            label: "Départements",
            value: String(new Set(employes.map((e) => e.departement)).size),
          },
          {
            label: "Masse salariale brute",
            value:
              formatFCFA(employes
                .filter((e) => e.actif)
                .reduce((s, e) => s + (Number(e.salaire) || 0), 0)),
          },
        ],
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users2 className="h-6 w-6 shrink-0 text-primary" /> Employés
          </h1>
          <p className="text-sm text-muted-foreground">Gestion du personnel</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!employes.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Renuméroter tous les matricules (EMP-00001…) ?"))
                renumberMutation.mutate();
            }}
            disabled={renumberMutation.isPending || !employes.length}
          >
            <ListOrdered className="mr-2 h-4 w-4" /> Renuméroter
          </Button>
          <Button onClick={() => navigate({ to: "/employes/nouveau" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouvel employé
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] whitespace-nowrap">Matricule</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Département</TableHead>
              <TableHead className="text-right">Salaire</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : employes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6">
                  <EmptyState
                    variant={q ? "compact" : "rich"}
                    icon={Users2}
                    title={
                      q
                        ? "Aucun employé ne correspond à votre recherche."
                        : "Aucun employé enregistré."
                    }
                    description={
                      q
                        ? undefined
                        : "Ajoutez vos collaborateurs pour gérer paies, absences, congés et documents RH."
                    }
                    onReset={q ? () => setSearch("") : undefined}
                    action={
                      !q ? (
                        <Can permission="employes.creer">
                          <Button asChild size="sm">
                            <Link to="/employes/nouveau">
                              <Plus className="mr-2 h-4 w-4" /> Nouvel employé
                            </Link>
                          </Button>
                        </Can>
                      ) : undefined
                    }
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              employes.map((emp) => (
                <TableRow key={emp.employe_id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {emp.matricule}
                  </TableCell>
                  <TableCell className="font-medium">{emp.nom_complet}</TableCell>
                  <TableCell>{emp.prenoms ?? "—"}</TableCell>
                  <TableCell>{emp.poste ?? "—"}</TableCell>
                  <TableCell>{DEPARTEMENT_LABEL[emp.departement] ?? emp.departement}</TableCell>
                  <TableCell className="text-right">{formatFCFA(Number(emp.salaire))}</TableCell>
                  <TableCell>
                    <Badge variant={emp.actif ? "default" : "secondary"}>
                      {emp.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${emp.nom_complet}`}
                    >
                      <Link
                        to="/employes/$employeId/modifier"
                        params={{ employeId: emp.employe_id }}
                        title={`Modifier ${emp.nom_complet}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Can permission="employes.supprimer">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer l'employé"
                        onClick={() => setToDelete(emp)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </Can>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Télécharger la fiche PDF de ${emp.nom_complet}`}
                      title="Télécharger la fiche PDF"
                      onClick={async () => {
                        try {
                          await generateEmployeFichePDF(emp);
                        } catch (e) {
                          toast.error(friendlyError(e, "Erreur PDF"));
                        }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cet employé ?"
        entityLabel="l'employé"
        entityName={toDelete ? `${toDelete.nom_complet} (${toDelete.matricule})` : null}
        description={`Suppression logique — la fiche sera masquée et restaurable pendant ${RETENTION_DAYS} jours.`}
        consequences={[
          "Fiche employé masquée des listes",
          "Documents, contrats et bulletins conservés",
          "Journal d'audit renseigné",
          `Restauration possible pendant ${RETENTION_DAYS} jours`,
        ]}
        pending={deleteMutation.isPending}
        onConfirm={(motif) => {
          if (toDelete) deleteMutation.mutate({ emp: toDelete, motif });
        }}
      />
    </div>
  );
}
