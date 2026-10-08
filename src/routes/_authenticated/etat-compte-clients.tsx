import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Search, Download, FileDown, Bug } from "lucide-react";
import { toast } from "sonner";

import { formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildEtatCompteClientPDF } from "@/lib/pdf/etat-compte-builder";
import { buildClientHistoriquePDF } from "@/lib/pdf/client-historique-builder";
import { getClient, getClientRelations } from "@/lib/clients-api";
import { downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { exportListePDF } from "@/lib/pdf/exportListe";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { useEtatCompteClients, type EtatCompteClient } from "@/hooks/use-etat-compte-clients";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EtatCompteDebugPanel } from "@/components/etat-compte/EtatCompteDebugPanel";
import { EtatCompteTable } from "@/components/etat-compte/EtatCompteTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from '@/lib/friendly-error';

export const Route = createFileRoute("/_authenticated/etat-compte-clients")({
  component: EtatComptePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function EtatComptePage() {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [historiqueBusy, setHistoriqueBusy] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<"tous" | "debiteurs" | "soldes">("tous");
  const q = useDebouncedValue(search, 300);
  const exerciceId = useExerciceConsulteId();

  const { data, isLoading } = useEtatCompteClients(q, exerciceId);

  const allClients = data?.rows ?? [];
  const clients = allClients.filter((c) => {
    const s = Number(c.solde);
    if (statutFilter === "debiteurs") return s > 0;
    if (statutFilter === "soldes") return s === 0;
    return true;
  });
  const debugByClient = data?.debugByClient;
  const dateDebut = data?.dateDebut ?? null;
  const dateFin = data?.dateFin ?? null;
  const totalDu = clients.reduce((s, c) => s + Number(c.solde), 0);
  const debiteurs = clients.filter((c) => Number(c.solde) > 0).length;
  const [debugOpen, setDebugOpen] = useState(false);

  function handleExportDebug() {
    if (!debugByClient) return;
    const trace = {
      generatedAt: new Date().toISOString(),
      exerciceId,
      periode: { dateDebut, dateFin },
      filtresGlobaux: {
        statutPaiements: "valide",
        statutAvoirs: "valide",
      },
      totalDu,
      clients: clients.map((c) => ({
        reference: c.reference,
        nom: c.nom,
        soldeTableau: c.solde,
        debug: debugByClient.get(c.client_id) ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(blob, `debug_etat_compte_${stamp}.json`);
    toast.success("Trace debug exportée");
  }

  function handleExport() {
    const totalImpaye = clients.reduce((s, c) => s + Number(c.solde), 0);
    const nbDebiteurs = clients.filter((c) => Number(c.solde) > 0).length;
    exportCsv(
      "etat_compte_clients",
      ["Référence", "Client", "Représentant", "Tél. représentant", "Solde dû"],
      clients.map((c) => [
        c.reference,
        c.nom,
        c.representant ?? "—",
        c.telephone ?? "—",
        String(c.solde),
      ]),
      {
        summary: [
          { label: "Nombre total de lignes", value: String(clients.length) },
          { label: "Nombre de clients", value: String(clients.length) },
          { label: "Clients débiteurs", value: String(nbDebiteurs) },
          { label: "Total impayé (FCFA)", value: formatFCFA(totalImpaye) },
          { label: "Date d'export", value: new Date().toLocaleString("fr-FR") },
        ],
      },
    );
  }

  async function handleExportPdf() {
    const statutLabel =
      statutFilter === "debiteurs"
        ? "Clients débiteurs"
        : statutFilter === "soldes"
          ? "Clients soldés"
          : "Tous les clients";
    const filtres: string[] = [`Statut : ${statutLabel}`];
    if (q) filtres.push(`Recherche : ${q}`);
    if (dateDebut && dateFin) filtres.push(`Période : ${dateDebut} → ${dateFin}`);
    const totalDuExport = clients.reduce((s, c) => s + Number(c.solde), 0);
    const nbDebiteurs = clients.filter((c) => Number(c.solde) > 0).length;
    const nbSoldes = clients.filter((c) => Number(c.solde) === 0).length;
    await exportListePDF({
      titre: "États de compte clients",
      colonnes: ["Référence", "Client", "Représentant", "Tél. représentant", "Solde dû (FCFA)"],
      lignes: clients.map((c) => [
        c.reference,
        c.nom,
        c.representant ?? "—",
        c.telephone ?? "—",
        formatFCFA(Number(c.solde)),
      ]),
      filtres,
      recap: [
        { label: "Nombre de clients", valeur: String(clients.length) },
        { label: "Clients débiteurs", valeur: String(nbDebiteurs) },
        { label: "Clients soldés", valeur: String(nbSoldes) },
        { label: "Total dû", valeur: `${formatFCFA(totalDuExport)} FCFA` },
        { label: "Généré le", valeur: new Date().toLocaleString("fr-FR") },
      ],
      filename: `etat_compte_clients_${statutFilter}`,
    });
  }

  async function handlePdf(c: EtatCompteClient) {
    try {
      setBusy(c.client_id);
      const blob = await buildEtatCompteClientPDF({
        clientId: c.client_id,
        clientNom: c.nom,
        clientTel: c.telephone,
        representant: c.representant,
        exerciceId,
      });
      downloadBlob(blob, fileNameFor(`EC_${c.reference}`, c.nom));
      toast.success(`État de compte ${c.nom} généré`);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur PDF"));
    } finally {
      setBusy(null);
    }
  }

  async function handleHistorique(c: EtatCompteClient) {
    try {
      setHistoriqueBusy(c.client_id);
      const client = await getClient(c.client_id);
      if (!client) throw new Error("Client introuvable");
      const rel = await getClientRelations(c.client_id, client.nom);
      const blob = await buildClientHistoriquePDF(client, rel);
      downloadBlob(blob, fileNameFor(`Historique_${c.reference}`, c.nom));
      toast.success(`Historique ${c.nom} généré`);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur PDF"));
    } finally {
      setHistoriqueBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> États de compte clients
          </h1>
          <p className="text-sm text-muted-foreground">Soldes et créances clients</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDebugOpen((v) => !v)}
            disabled={!clients.length}
          >
            <Bug className="mr-2 h-4 w-4" /> {debugOpen ? "Masquer" : "Afficher"} debug
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDebug}
            disabled={!clients.length}
          >
            <FileDown className="mr-2 h-4 w-4" /> Exporter trace debug
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!clients.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={!clients.length}>
            <FileDown className="mr-2 h-4 w-4" /> Exporter PDF
          </Button>
        </div>
      </div>

      {debugOpen && debugByClient && (
        <EtatCompteDebugPanel
          clients={clients}
          debugByClient={debugByClient}
          dateDebut={dateDebut}
          dateFin={dateFin}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total dû</p>
            <p className="text-xl font-bold text-destructive">{formatFCFA(totalDu)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clients débiteurs</p>
            <p className="text-xl font-bold">{debiteurs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total clients</p>
            <p className="text-xl font-bold">{clients.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statutFilter}
          onValueChange={(v) => setStatutFilter(v as "tous" | "debiteurs" | "soldes")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Statut du compte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les clients</SelectItem>
            <SelectItem value="debiteurs">Clients débiteurs</SelectItem>
            <SelectItem value="soldes">Clients soldés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <EtatCompteTable
        clients={clients}
        isLoading={isLoading}
        busy={busy}
        historiqueBusy={historiqueBusy}
        onPdf={handlePdf}
        onHistorique={handleHistorique}
      />
    </div>
  );
}
