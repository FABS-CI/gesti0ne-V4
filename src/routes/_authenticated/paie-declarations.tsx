import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import {
  buildDeclOptions,
  buildPdf,
  computeLignes,
  computeTotaux,
  periodesTriees,
  type BulletinDeclare,
  type PdfOpts,
} from "@/lib/paie-declarations-helpers";
import { DeclarationsToolbar } from "@/components/paie-declarations/DeclarationsToolbar";
import { DeclarationsTable } from "@/components/paie-declarations/DeclarationsTable";
import {
  DeclarationPreviewDialog,
  type PreviewState,
} from "@/components/paie-declarations/DeclarationPreviewDialog";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie-declarations")({
  component: DeclarationsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function DeclarationsPage() {
  const [periode, setPeriode] = useState<string>("");
  const exerciceId = useExerciceConsulteId();
  const [preview, setPreview] = useState<PreviewState>(null);

  const { data: periodesList } = useQuery({
    queryKey: ["bulletins_periodes", exerciceId],
    enabled: !!exerciceId,
    queryFn: async () => {
      let query = supabase
        .from("bulletins_paie")
        .select("periode, date_fin");
      if (exerciceId) query = query.eq("exercice_id", exerciceId);
      const { data, error } = await query;
      if (error) throw error;
      // Libellés « Octobre 2026 » : tri par date de fin, pas alphabétique.
      return periodesTriees(data ?? []);
    },
  });

  const { data: bulletins, isLoading } = useQuery({
    queryKey: ["bulletins_periode", exerciceId, periode],
    enabled: !!periode && !!exerciceId,
    queryFn: async (): Promise<BulletinDeclare[]> => {
      // Montants lus sur les lignes enregistrées : les déclarations reprennent exactement les bulletins.
      let query = supabase
        .from("bulletins_paie")
        .select(
          "bulletin_id, employe_nom, statut, salaire_brut, brut_imposable, salaire_net, net_a_payer, bulletin_lignes(numero_rubrique, code, designation, libelle, bloc, retenue)",
        )
        .eq("periode", periode);
      if (exerciceId) query = query.eq("exercice_id", exerciceId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BulletinDeclare[];
    },
  });

  const lignes = useMemo(() => computeLignes(bulletins), [bulletins]);
  const totaux = useMemo(() => computeTotaux(lignes), [lignes]);
  const opts = useMemo(
    () => buildDeclOptions(periode, lignes, totaux),
    [periode, lignes, totaux],
  );

  const disabled = !periode || lignes.length === 0;

  const previewPdf = async (o: PdfOpts) => {
    if (preview) URL.revokeObjectURL(preview.url);
    const url = (await buildPdf(o, "blob")) as string;
    setPreview({ url, title: o.title, fileName: o.fileName });
  };
  const downloadPdf = (o: PdfOpts) => {
    void buildPdf(o);
  };
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <ScrollText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="ds-page-title">Déclarations sociales & fiscales</h1>
          <p className="text-sm text-muted-foreground">
            CNPS · ITS · CN · CMU · DISA — Génération automatique depuis les bulletins de paie
          </p>
        </div>
      </div>

      <DeclarationsToolbar
        periode={periode}
        onPeriodeChange={setPeriode}
        periodesList={periodesList ?? []}
        disabled={disabled}
        cnps={opts.cnps}
        its={opts.its}
        disa={opts.disa}
        onPreview={previewPdf}
        onDownload={downloadPdf}
      />

      <DeclarationsTable periode={periode} isLoading={isLoading} lignes={lignes} totaux={totaux} />

      <DeclarationPreviewDialog preview={preview} onClose={closePreview} />
    </div>
  );
}
