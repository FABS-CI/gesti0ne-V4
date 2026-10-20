import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileDown, Loader2, Minus, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatFCFA } from "@/lib/format";
import {
  generateBulletinPaieCIPDF,
  bulletinFileName,
  ENTREPRISE_FABS,
} from "@/lib/pdf/bulletinPaieCI";
import { construireDonneesPdf, calculerCumuls, type BulletinCumul, type BulletinStocke, type LigneStockee } from "@/lib/paie/bulletin-pdf-data";
import { usePdfDownload } from "@/hooks/use-pdf-download";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie/$bulletinId")({
  component: BulletinDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Bulletin = {
  bulletin_id: string;
  employe_nom: string;
  periode: string;
  salaire_brut: number;
  retenues: number;
  salaire_net: number;
  statut: string;
  created_at: string;
};

const STATUTS: Record<string, { label: string; color: string }> = {
  genere: { label: "Généré", color: "#3B82F6" },
  valide: { label: "Validé", color: "#10B981" },
  paye: { label: "Payé", color: "#14B8A6" },
};

async function getBulletin(id: string) {
  const { data, error } = await supabase
    .from("bulletins_paie")
    .select("*")
    .eq("bulletin_id", id)
    .single();
  if (error) throw error;
  return data as Bulletin;
}

function frDate(d: string | null | undefined) {
  return d ? formatDate(d) : "—";
}

function BulletinDetailPage() {
  const { bulletinId } = Route.useParams();
  const pdf = usePdfDownload();
  const { data: bulletin, isLoading } = useQuery({
    queryKey: ["bulletin", bulletinId],
    queryFn: () => getBulletin(bulletinId),
  });

  const { data: lignes } = useQuery({
    queryKey: ["bulletin-lignes", bulletinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletin_lignes")
        .select("numero_rubrique,designation,libelle,nombre,base,taux,gain,retenue,bloc,ordre")
        .eq("bulletin_id", bulletinId)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as LigneStockee[];
    },
  });
  const employeId = (bulletin as { employe_id?: string | null } | undefined)?.employe_id;
  const { data: employe } = useQuery({
    queryKey: ["bulletin-employe", employeId],
    enabled: !!employeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employes")
        .select("matricule,poste,categorie,numero_cnps,date_embauche,departement,adresse")
        .eq("employe_id", employeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dateFin = (bulletin as { date_fin?: string | null } | undefined)?.date_fin;
  const { data: cumuls } = useQuery({
    queryKey: ["bulletin-cumuls", employeId, dateFin],
    enabled: !!employeId && !!dateFin,
    queryFn: async () => {
      const debutAnnee = `${dateFin!.slice(0, 4)}-01-01`;
      const { data, error } = await supabase
        .from("bulletins_paie")
        .select("brut_imposable,jours_travailles,bulletin_lignes(numero_rubrique,retenue)")
        .eq("employe_id", employeId!)
        .gte("date_fin", debutAnnee)
        .lte("date_fin", dateFin!);
      if (error) throw error;
      return calculerCumuls(
        (data ?? []).map((b) => ({
          brut_imposable: b.brut_imposable,
          jours_travailles: b.jours_travailles,
          lignes: (b.bulletin_lignes ?? []) as BulletinCumul["lignes"],
        })),
      );
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!bulletin)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Bulletin introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/paie">Retour</Link>
        </Button>
      </div>
    );

  const st = STATUTS[bulletin.statut];

  return (
    <div className="space-y-6">
      <RhPageHeader
        title={bulletin.employe_nom}
        subtitle={`Bulletin — ${bulletin.periode}`}
        backTo="/paie"
        crumbs={[{ label: "Paie", to: "/paie" }, { label: bulletin.periode }]}
        actions={
          <>
            {(() => {
              const pst = pdf.getState(bulletin.bulletin_id);
              const data = construireDonneesPdf(
                bulletin as unknown as BulletinStocke,
                lignes ?? [],
                employe ?? null,
                ENTREPRISE_FABS,
                cumuls,
              );
              return (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pst.loading || !lignes?.length}
                  onClick={() =>
                    pdf.download(
                      bulletin.bulletin_id,
                      () => Promise.resolve(generateBulletinPaieCIPDF(data)),
                      bulletinFileName(data.reference, bulletin.employe_nom),
                    )
                  }
                >
                  {pst.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  {pst.loading ? "Génération…" : "Télécharger PDF"}
                </Button>
              );
            })()}
            {st && (
              <Badge style={{ backgroundColor: st.color }} className="text-white">
                {st.label}
              </Badge>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Employé
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{bulletin.employe_nom}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Période
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{bulletin.periode}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Salaire brut
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{formatFCFA(bulletin.salaire_brut)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="h-4 w-4" /> Retenues
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium text-destructive">
            {formatFCFA(bulletin.retenues)}
          </CardContent>
        </Card>
      </div>

      {!!lignes?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Lignes du bulletin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b text-left">
                  <th className="py-1 pr-2">N°</th>
                  <th className="py-1 pr-2">Désignation</th>
                  <th className="py-1 pr-2 text-right">Base</th>
                  <th className="py-1 pr-2 text-right">Taux</th>
                  <th className="py-1 pr-2 text-right">Gains</th>
                  <th className="py-1 text-right">Retenues</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.ordre} className={`border-b ${l.bloc === "patronal" ? "text-muted-foreground" : ""}`}>
                    <td className="py-1 pr-2">{l.numero_rubrique}</td>
                    <td className="py-1 pr-2">
                      {l.designation ?? l.libelle}
                      {l.bloc === "patronal" ? " (employeur)" : ""}
                    </td>
                    <td className="py-1 pr-2 text-right">{l.base != null ? formatFCFA(l.base, false) : ""}</td>
                    <td className="py-1 pr-2 text-right">{l.taux != null ? `${l.taux} %` : ""}</td>
                    <td className="py-1 pr-2 text-right">{l.gain ? formatFCFA(l.gain, false) : ""}</td>
                    <td className="py-1 text-right">{l.retenue ? formatFCFA(l.retenue, false) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salaire brut</span>
            <span className="font-medium">{formatFCFA(bulletin.salaire_brut)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retenues</span>
            <span className="font-medium text-destructive">- {formatFCFA(bulletin.retenues)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base">
            <span className="font-semibold">Salaire net</span>
            <span className="font-bold text-primary">{formatFCFA(bulletin.salaire_net)}</span>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Généré le {frDate(bulletin.created_at)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
