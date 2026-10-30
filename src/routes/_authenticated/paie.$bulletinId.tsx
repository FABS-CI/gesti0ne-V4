import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Minus, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatFCFA } from "@/lib/format";
import type { LigneStockee } from "@/lib/paie/bulletin-pdf-data";
import { BulletinActionButtons } from "@/components/paie/BulletinActionButtons";
import { dateEnLettres } from "@/lib/pdf/bulletinPaieCI";
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
  net_a_payer: number | null;
  date_paiement: string | null;
  mode_paiement: string | null;
  statut: string;
  created_at: string;
};

const STATUTS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "#64748B" },
  genere: { label: "Généré", color: "#3B82F6" },
  valide: { label: "Validé", color: "#10B981" },
  paye: { label: "Payé", color: "#14B8A6" },
  annule: { label: "Annulé", color: "#DC2626" },
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
  // CMU salariée enregistrée : rubrique 470 (bulletins anciens : 776). Aucun montant supposé.
  const cmuSalarie =
    lignes?.find((l) => l.numero_rubrique === "470" || l.numero_rubrique === "776")?.retenue ?? null;

  return (
    <div className="space-y-6">
      <RhPageHeader
        title={bulletin.employe_nom}
        subtitle={`Bulletin — ${bulletin.periode}`}
        backTo="/paie"
        crumbs={[{ label: "Paie", to: "/paie" }, { label: bulletin.periode }]}
        actions={
          <>
            <BulletinActionButtons bulletinId={bulletin.bulletin_id} statut={bulletin.statut} showLabels />
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
          <div className="flex justify-between pl-4 text-xs">
            <span className="text-muted-foreground">dont CMU salarié</span>
            <span>{cmuSalarie == null ? "—" : formatFCFA(cmuSalarie)}</span>
          </div>
          <div
            className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 overflow-hidden rounded-md border-[1.5px] py-3 pl-[23px] pr-4"
            style={{
              backgroundColor: "#EAF1F8",
              borderColor: "#0B2540",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
              breakInside: "avoid",
              pageBreakInside: "avoid",
            }}
          >
            <span
              className="text-[13px] font-bold uppercase"
              style={{ color: "#0B2540", letterSpacing: "0.5px" }}
            >
              Net à payer
            </span>
            <span className="text-right">
              <span className="block text-[22px] font-bold tabular-nums" style={{ color: "#0B2540" }}>
                {formatFCFA(bulletin.net_a_payer ?? bulletin.salaire_net)}
              </span>
              {bulletin.date_paiement && (
                <span className="block text-[8px]" style={{ color: "#0B2540", opacity: 0.8 }}>
                  Payé {bulletin.mode_paiement ? `par ${bulletin.mode_paiement.toLowerCase()} ` : ""}le{" "}
                  {dateEnLettres(bulletin.date_paiement)}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="absolute bottom-[1.5px] left-[1.5px] top-[1.5px] w-[5px]"
              style={{ backgroundColor: "#F26A1B" }}
            />
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Généré le {frDate(bulletin.created_at)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
