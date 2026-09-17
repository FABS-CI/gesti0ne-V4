import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Calendar,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plane,
  Wallet,
  Wallet2,
} from "lucide-react";

import {
  getEmploye,
  getEmployeConges,
  getEmployeAbsences,
  getEmployeContrats,
  getEmployeBulletins,
} from "@/lib/rh-api";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/employes/$employeId/")({
  component: EmployeDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

type Bulletin = {
  periode: string;
  salaire_brut: number;
  retenues: number;
  salaire_net: number;
  statut: string;
};
type Contrat = {
  type: string;
  date_debut: string;
  date_fin: string | null;
  salaire: number;
  statut: string;
};
type Absence = {
  type_absence: string;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  statut: string;
};

function EmployeDetailPage() {
  const { employeId } = Route.useParams();
  const { data: employe, isLoading } = useQuery({
    queryKey: ["employe", employeId],
    queryFn: () => getEmploye(employeId),
  });
  const { data: conges = [] } = useQuery({
    queryKey: ["employe-conges", employeId],
    queryFn: () => getEmployeConges(employeId),
  });
  const { data: absences = [] } = useQuery({
    queryKey: ["employe-absences", employeId],
    queryFn: () => getEmployeAbsences(employeId),
  });
  const { data: contrats = [] } = useQuery({
    queryKey: ["employe-contrats", employeId],
    queryFn: () => getEmployeContrats(employeId),
  });
  const { data: bulletins = [] } = useQuery({
    queryKey: ["employe-bulletins", employeId],
    queryFn: () => getEmployeBulletins(employeId),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!employe)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Employé introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/employes">Retour</Link>
        </Button>
      </div>
    );

  const totalPaye = (bulletins as Bulletin[]).reduce((s, b) => s + Number(b.salaire_net ?? 0), 0);
  const congesApprouves = conges.filter((c) => c.statut === "approuve").length;
  const contratActif = (contrats as Contrat[]).find((c) => c.statut === "actif");

  return (
    <div className="space-y-6">
      <RhPageHeader
        title={employe.nom_complet}
        subtitle={employe.matricule}
        backTo="/employes"
        crumbs={[{ label: "Employés", to: "/employes" }, { label: employe.nom_complet }]}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/employes/$employeId/modifier"
                params={{ employeId }}
                title={`Modifier ${employe.nom_complet}`}
              >
                <Pencil className="mr-2 h-4 w-4" /> Modifier
              </Link>
            </Button>
            <Badge variant={employe.actif ? "secondary" : "destructive"}>
              {employe.actif ? "Actif" : "Inactif"}
            </Badge>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Briefcase} label="Poste" value={employe.poste ?? "—"} />
        <Kpi icon={Building2} label="Département" value={employe.departement} />
        <Kpi icon={Wallet} label="Salaire" value={formatFCFA(employe.salaire)} accent />
        <Kpi icon={Calendar} label="Embauché le" value={frDate(employe.date_embauche)} />
        <Kpi icon={Plane} label="Congés approuvés" value={String(congesApprouves)} />
        <Kpi
          icon={FileText}
          label="Contrat actif"
          value={contratActif ? contratActif.type : "—"}
        />
        <Kpi icon={Wallet2} label="Total payé" value={formatFCFA(totalPaye)} />
        <Kpi icon={Mail} label="Email" value={employe.email ?? "—"} />
      </div>

      <Tabs defaultValue="infos" className="w-full">
        <TabsList>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="conges">Congés ({conges.length})</TabsTrigger>
          <TabsTrigger value="absences">Absences ({absences.length})</TabsTrigger>
          <TabsTrigger value="contrats">Contrats ({contrats.length})</TabsTrigger>
          <TabsTrigger value="paie">Paie ({bulletins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> {employe.email ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> {employe.telephone ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" /> {employe.departement}
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> {employe.poste ?? "—"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conges">
          <Card>
            <CardHeader>
              <CardTitle>Historique des congés</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleTable
                headers={["Type", "Début", "Fin", "Motif", "Statut"]}
                rows={conges.map((c) => [
                  <span className="capitalize">{c.type}</span>,
                  frDate(c.date_debut),
                  frDate(c.date_fin),
                  c.motif ?? "—",
                  <Badge variant="outline" className="capitalize">
                    {c.statut}
                  </Badge>,
                ])}
                emptyLabel="Aucun congé"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences">
          <Card>
            <CardHeader>
              <CardTitle>Historique des absences</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleTable
                headers={["Type", "Début", "Fin", "Motif", "Statut"]}
                rows={(absences as Absence[]).map((a) => [
                  <span className="capitalize">{a.type_absence}</span>,
                  frDate(a.date_debut),
                  frDate(a.date_fin),
                  a.motif ?? "—",
                  <Badge variant="outline" className="capitalize">
                    {a.statut}
                  </Badge>,
                ])}
                emptyLabel="Aucune absence"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrats">
          <Card>
            <CardHeader>
              <CardTitle>Contrats</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleTable
                headers={["Type", "Début", "Fin", "Salaire", "Statut"]}
                rows={(contrats as Contrat[]).map((c) => [
                  <span className="uppercase">{c.type}</span>,
                  frDate(c.date_debut),
                  frDate(c.date_fin),
                  formatFCFA(c.salaire),
                  <Badge variant="outline" className="capitalize">
                    {c.statut}
                  </Badge>,
                ])}
                emptyLabel="Aucun contrat"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paie">
          <Card>
            <CardHeader>
              <CardTitle>Bulletins de paie</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleTable
                headers={["Période", "Brut", "Retenues", "Net", "Statut"]}
                rows={(bulletins as Bulletin[]).map((b) => [
                  b.periode,
                  formatFCFA(b.salaire_brut),
                  formatFCFA(b.retenues),
                  <span className="font-semibold">{formatFCFA(b.salaire_net)}</span>,
                  <Badge variant="outline" className="capitalize">
                    {b.statut}
                  </Badge>,
                ])}
                emptyLabel="Aucun bulletin"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={accent ? "text-lg font-bold text-primary" : "truncate font-medium"}>
        {value}
      </CardContent>
    </Card>
  );
}

function SimpleTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyLabel: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((cells, i) => (
            <TableRow key={i}>
              {cells.map((c, j) => (
                <TableCell key={j}>{c}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
