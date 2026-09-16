import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileSignature, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/contrats/$contratId/")({
  component: ContratDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Contrat = {
  contrat_id: string;
  employe_nom: string;
  type_contrat: string;
  date_debut: string;
  date_fin: string | null;
  salaire: number;
  statut: string;
  notes: string | null;
  created_at: string;
};

const TYPES: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  prestation: "Prestation",
};

const STATUTS: Record<string, { label: string; color: string }> = {
  actif: { label: "Actif", color: "#10B981" },
  expire: { label: "Expiré", color: "#64748B" },
  resilie: { label: "Résilié", color: "#EF4444" },
};

async function getContrat(id: string) {
  const { data, error } = await supabase
    .from("contrats")
    .select("*")
    .eq("contrat_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Contrat | null;
}

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function ContratDetailPage() {
  const { contratId } = Route.useParams();
  const { data: contrat, isLoading } = useQuery({
    queryKey: ["contrat", contratId],
    queryFn: () => getContrat(contratId),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!contrat)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Contrat introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/contrats">Retour</Link>
        </Button>
      </div>
    );

  const st = STATUTS[contrat.statut];

  return (
    <div className="space-y-6">
      <RhPageHeader
        title={contrat.employe_nom}
        subtitle={`Contrat ${TYPES[contrat.type_contrat] ?? contrat.type_contrat}`}
        backTo="/contrats"
        crumbs={[{ label: "Contrats", to: "/contrats" }, { label: contrat.employe_nom }]}
        actions={
          st ? (
            <Badge style={{ backgroundColor: st.color }} className="text-white">
              {st.label}
            </Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Employé
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{contrat.employe_nom}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSignature className="h-4 w-4" /> Type
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {TYPES[contrat.type_contrat] ?? contrat.type_contrat}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Salaire
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(contrat.salaire)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Période
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {frDate(contrat.date_debut)} → {frDate(contrat.date_fin)}
          </CardContent>
        </Card>
      </div>

      {contrat.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {contrat.notes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
