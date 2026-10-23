import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/Money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { authRouteHead } from "@/lib/route-head";
import { friendlyError } from "@/lib/friendly-error";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";
import { generateBulletinPaieCIPDF } from "@/lib/pdf/bulletinPaieCI";
import { buildBulletinRowPdf } from "@/lib/paie-bulletin-actions";

export const Route = createFileRoute("/_authenticated/paie-exports")({
  head: () => authRouteHead("Exports Paie"),
  component: ExportsPaiePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const num = (v: unknown) => Number(v) || 0;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function ExportsPaiePage() {
  const now = new Date();
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [mois, setMois] = useState(String(now.getMonth()));
  const [busy, setBusy] = useState<string | null>(null);

  const { data: bulletins = [], isLoading } = useQuery({
    queryKey: ["paie-exports-bulletins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletins_paie")
        .select("bulletin_id, reference, employe_id, employe_nom, date_debut, date_fin, date_bulletin, created_at, statut, salaire_brut, brut_imposable, cotisations, retenues, net_a_payer, salaire_net, cout_salarial")
        .limit(5000);
      if (error) throw error;
      return (data ?? [])
        .filter((b) => !/annul/i.test(b.statut ?? ""))
        .map((b) => {
          const d = new Date(b.date_fin ?? b.date_debut ?? b.date_bulletin ?? b.created_at);
          return { ...b, y: d.getFullYear(), m: d.getMonth() };
        });
    },
  });

  const annees = useMemo(() => {
    const s = new Set(bulletins.map((r) => String(r.y)));
    s.add(String(now.getFullYear()));
    return [...s].sort().reverse();
  }, [bulletins]);

  const duMois = bulletins
    .filter((b) => String(b.y) === annee && (mois === "all" || String(b.m) === mois))
    .sort((a, b) => (a.employe_nom ?? "").localeCompare(b.employe_nom ?? ""));
  const deLAnnee = bulletins.filter((b) => String(b.y) === annee);
  const periode = mois === "all" ? annee : `${MOIS[Number(mois)]} ${annee}`;
  const slug = mois === "all" ? annee : `${annee}-${String(Number(mois) + 1).padStart(2, "0")}`;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      toast.success(`${label} téléchargé`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = () =>
    run("PDF des bulletins", async () => {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      const ignores: string[] = [];
      for (const b of duMois) {
        try {
          const { data } = await buildBulletinRowPdf(b.bulletin_id);
          const src = await PDFDocument.load(await (await generateBulletinPaieCIPDF(data)).arrayBuffer());
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
        } catch {
          ignores.push(b.reference ?? b.employe_nom ?? b.bulletin_id);
        }
      }
      if (out.getPageCount() === 0) throw new Error("Aucun bulletin exportable sur cette période.");
      if (ignores.length) toast.warning(`Bulletins sans lignes détaillées ignorés : ${ignores.join(", ")}`);
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `bulletins_${slug}.pdf`);
    });

  const exportLivre = () =>
    run("Livre de paie", async () => {
      const XLSX = await import("xlsx");
      const ids = duMois.map((b) => b.bulletin_id);
      const lignes: { bulletin_id: string; numero_rubrique: string | null; designation: string | null; libelle: string | null; base: number | null; taux: number | null; gain: number | null; retenue: number | null }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("bulletin_lignes")
          .select("bulletin_id, numero_rubrique, designation, libelle, base, taux, gain, retenue, ordre")
          .in("bulletin_id", ids.slice(i, i + 200))
          .order("ordre");
        if (error) throw error;
        lignes.push(...(data ?? []));
      }
      const parId = new Map(duMois.map((b) => [b.bulletin_id, b]));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          duMois.map((b) => ({
            Référence: b.reference,
            Employé: b.employe_nom,
            "Début période": b.date_debut,
            "Fin période": b.date_fin,
            Statut: b.statut,
            "Brut imposable": num(b.brut_imposable ?? b.salaire_brut),
            Cotisations: num(b.cotisations),
            Retenues: num(b.retenues),
            "Net à payer": num(b.net_a_payer ?? b.salaire_net),
            "Coût employeur": num(b.cout_salarial),
          })),
        ),
        "Livre de paie",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          lignes.map((l) => ({
            Référence: parId.get(l.bulletin_id)?.reference,
            Employé: parId.get(l.bulletin_id)?.employe_nom,
            Code: l.numero_rubrique,
            Désignation: l.designation ?? l.libelle,
            Base: l.base,
            Taux: l.taux,
            Gain: num(l.gain),
            Retenue: num(l.retenue),
          })),
        ),
        "Détail des lignes",
      );
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      downloadBlob(new Blob([buf], { type: XLSX_MIME }), `livre_de_paie_${slug}.xlsx`);
    });

  const exportRecap = () =>
    run("Récapitulatif", async () => {
      const XLSX = await import("xlsx");
      const rows = MOIS.map((label, m) => {
        const bs = deLAnnee.filter((b) => b.m === m);
        return {
          Mois: label,
          Bulletins: bs.length,
          "Brut imposable": bs.reduce((s, b) => s + num(b.brut_imposable ?? b.salaire_brut), 0),
          Cotisations: bs.reduce((s, b) => s + num(b.cotisations), 0),
          Retenues: bs.reduce((s, b) => s + num(b.retenues), 0),
          "Net versé": bs.reduce((s, b) => s + num(b.net_a_payer ?? b.salaire_net), 0),
          "Coût employeur": bs.reduce((s, b) => s + num(b.cout_salarial), 0),
        };
      });
      const total = rows.reduce(
        (t, r) => {
          for (const k of Object.keys(r) as (keyof typeof r)[]) if (k !== "Mois") (t[k] as number) += r[k] as number;
          return t;
        },
        { Mois: `Total ${annee}`, Bulletins: 0, "Brut imposable": 0, Cotisations: 0, Retenues: 0, "Net versé": 0, "Coût employeur": 0 },
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...rows, total]), `Récap ${annee}`);
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      downloadBlob(new Blob([buf], { type: XLSX_MIME }), `recap_masse_salariale_${annee}.xlsx`);
    });

  const totalNet = duMois.reduce((s, b) => s + num(b.net_a_payer ?? b.salaire_net), 0);
  const dis = busy !== null || isLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="ds-page-title">Exports Paie</h1>
        <p className="text-sm text-muted-foreground">Bulletins, livre de paie et récapitulatifs, à partir des bulletins enregistrés (hors annulés).</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="text-xs text-muted-foreground mb-1 block">Mois</label>
          <Select value={mois} onValueChange={setMois}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              {MOIS.map((l, i) => <SelectItem key={l} value={String(i)}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">Année</label>
          <Select value={annee} onValueChange={setAnnee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{annees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button variant="outline" disabled={dis || duMois.length === 0} onClick={exportPdf}>
            {busy === "PDF des bulletins" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Bulletins PDF
          </Button>
          <Button variant="outline" disabled={dis || duMois.length === 0} onClick={exportLivre}>
            {busy === "Livre de paie" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Livre de paie Excel
          </Button>
          <Button variant="outline" disabled={dis || deLAnnee.length === 0} onClick={exportRecap}>
            {busy === "Récapitulatif" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Récapitulatif {annee}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isLoading ? "Chargement…" : <>{duMois.length} bulletin(s) pour {periode} — total des nets <Money value={totalNet} /></>}
      </p>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Employé</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Net à payer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duMois.map((b) => (
              <TableRow key={b.bulletin_id}>
                <TableCell>{b.reference}</TableCell>
                <TableCell>{b.employe_nom}</TableCell>
                <TableCell>{MOIS[b.m]} {b.y}</TableCell>
                <TableCell>{b.statut}</TableCell>
                <TableCell className="text-right"><Money value={num(b.net_a_payer ?? b.salaire_net)} /></TableCell>
              </TableRow>
            ))}
            {!isLoading && duMois.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun bulletin sur cette période.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
