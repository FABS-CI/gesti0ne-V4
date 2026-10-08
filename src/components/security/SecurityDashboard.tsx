import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Activite = {
  created_at: string;
  action: string | null;
  table_name: string | null;
  user_email: string | null;
};

type Overview = {
  users_total: number;
  users_actifs: number;
  users_suspendus: number;
  users_verrouilles: number;
  roles_total: number;
  permissions_total: number;
  approbations_en_attente: number;
  connexions_24h: number;
  roles_sans_permission: string[];
  utilisateurs_sans_role: number;
  dernieres_activites: Activite[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SecurityDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["security", "admin-overview"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("security_admin_overview");
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Impossible de charger le tableau de bord sécurité.
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    { label: "Utilisateurs", value: data.users_total, icon: Users, tone: "text-primary" },
    { label: "Actifs", value: data.users_actifs, icon: UserCheck, tone: "text-emerald-600" },
    { label: "Suspendus", value: data.users_suspendus, icon: AlertTriangle, tone: "text-amber-600" },
    { label: "Verrouillés", value: data.users_verrouilles, icon: Lock, tone: "text-destructive" },
    { label: "Rôles", value: data.roles_total, icon: ShieldCheck, tone: "text-indigo-500" },
    { label: "Permissions", value: data.permissions_total, icon: KeyRound, tone: "text-sky-500" },
    {
      label: "Approbations en attente",
      value: data.approbations_en_attente,
      icon: Clock,
      tone: "text-orange-500",
    },
    { label: "Connexions 24h", value: data.connexions_24h, icon: UserCog, tone: "text-violet-500" },
  ];

  const chartData = [
    { name: "Actifs", total: data.users_actifs },
    { name: "Suspendus", total: data.users_suspendus },
    { name: "Verrouillés", total: data.users_verrouilles },
    { name: "Sans rôle", total: data.utilisateurs_sans_role },
  ];

  const conflits = [
    ...(data.utilisateurs_sans_role > 0
      ? [`${data.utilisateurs_sans_role} utilisateur(s) sans aucun rôle attribué`]
      : []),
    ...(data.roles_sans_permission ?? []).map((r) => `Rôle « ${r} » sans aucune permission`),
    ...(data.users_verrouilles > 0
      ? [`${data.users_verrouilles} compte(s) verrouillé(s) à traiter`]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              </div>
              <kpi.icon className={`h-5 w-5 ${kpi.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition des comptes</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Alertes & conflits détectés</CardTitle>
            <Badge variant={conflits.length ? "destructive" : "secondary"}>{conflits.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun conflit détecté : rôles et affectations cohérents.
              </p>
            ) : (
              conflits.map((c) => (
                <div
                  key={c}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{c}</span>
                </div>
              ))
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/utilisateurs">Gérer les utilisateurs</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/roles-v3">Rôles & permissions</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/audit">Journal d'audit</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dernières activités</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Objet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.dernieres_activites ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Aucune activité enregistrée.
                  </TableCell>
                </TableRow>
              ) : (
                data.dernieres_activites.map((a, i) => (
                  <TableRow key={`${a.created_at}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatDate(a.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{a.user_email ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline">{a.action ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.table_name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
