import { askConfirm } from "@/components/common/GlobalConfirm";
import { getCurrentUser } from "@/lib/current-user";
import { formatDateTime, formatTime } from "@/lib/format";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  Loader2,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  ShieldCheck,
  Cloud,
  Play,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Activity,
  Filter,
  Database
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useServerFn } from "@tanstack/react-start";
import { runFullBackup, runFullRestore } from "@/lib/backup.functions";
import { friendlyError } from "@/lib/friendly-error";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/backup")({
  component: BackupPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type BackupRow = {
  backup_id: string;
  created_at: string;
  finished_at: string | null;
  completed_at: string | null;
  user_email: string | null;
  type: string;
  destination: string;
  statut: string;
  trigger_type: "AUTOMATIC" | "MANUAL";
  scope_type: "GLOBAL" | "PROJECT";
  project_id: string | null;
  project_name: string | null;
  taille_octets: number | null;
  duree_ms: number | null;
  nb_tables: number | null;
  nb_enregistrements: number | null;
  fichier_nom: string | null;
  message: string | null;
  error_message: string | null;
  sha256: string | null;
  destination_url: string | null;
  is_test?: boolean | null;
  fichier_disponible?: boolean | null;
};

function formatSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

function BackupPage() {
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [history, setHistory] = useState<BackupRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<{ next_run_at: string | null; count: number }>({ 
    next_run_at: null, 
    count: 0 
  });
  const [filters, setFilters] = useState({
    project: "all",
    type: "all",
    status: "all"
  });
  
  const startBackup = useServerFn(runFullBackup);
  const startRestore = useServerFn(runFullRestore);

  useEffect(() => {
    (async () => {
      const { data: userData } = await getCurrentUser();
      if (!userData.user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role_compat", {
        _user_id: userData.user.id,
        _role: "super_admin",
      });
      setIsAdmin(!error && data === true);
    })();
  }, []);

  async function loadData() {
    setLoadingHistory(true);
    try {
      // 1. Charger l'historique avec filtres
      let query = supabase.from("backups").select("*");
      
      if (filters.project !== "all") query = query.eq("project_name", filters.project);
      if (filters.type === "GLOBAL" || filters.type === "PROJECT") {
        query = query.eq("scope_type", filters.type);
      }
      if (filters.status !== "all") query = query.eq("statut", filters.status === "Réussie" ? "succes" : "echec");

      const { data: historyData, error: historyError } = await query
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (historyError) throw historyError;
      setHistory((historyData ?? []) as BackupRow[]);

      // 2. Charger les stats dynamiques
      const { data: nextRun } = await supabase.rpc("get_next_backup_run");
      const { count } = await supabase.from("backups").select("*", { count: 'exact', head: true });
      
      setStats({
        next_run_at: nextRun as string,
        count: count ?? 0
      });

    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, filters]);

  async function handleBackup(scope: "GLOBAL" | "PROJECT" = "GLOBAL", projectName?: string, isTest = false) {
    setRunning(true);
    try {
      await startBackup({ 
        data: { 
          trigger: "manuel",
          isTest,
          scope,
          projectName: projectName || (scope === "GLOBAL" ? "Tous les projets" : undefined)
        } 
      });
      toast.success(isTest ? "Test réussi : archive générée, contrôlée et stockée" : `Sauvegarde ${scope === "GLOBAL" ? "intégrale" : "projet"} réussie`);
      loadData();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleRestore(backup: BackupRow) {
    if (!await askConfirm(`ATTENTION : Vous allez restaurer l'ERP à l'état du ${formatDateTime(backup.created_at)}. Cette action peut écraser des données récentes. Continuer ?`)) return;
    
    setRestoring(backup.backup_id);
    try {
      const result = await startRestore({ data: { backupId: backup.backup_id } });
      toast.success(`Restauration terminée : ${result.tables.length} tables, ${result.users} comptes, ${result.files} fichiers.`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setRestoring(null);
    }
  }

  const lastSuccess = history.find((h) => h.statut === "succes");

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="ds-page-title">Accès réservé aux administrateurs</h1>
        <p className="text-muted-foreground">Vous n'avez pas les permissions nécessaires pour accéder aux sauvegardes.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ds-page-title flex items-center gap-3">
            <DatabaseBackup className="h-8 w-8 text-primary" />
            Sauvegarde & Restauration
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion intégrale de la sécurité de vos données (Données + Fichiers + Comptes).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => handleBackup("GLOBAL", undefined, true)}
            disabled={running}
            className="font-bold"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            TESTER MAINTENANT
          </Button>
          <Button 
            variant="outline"
            size="lg" 
            onClick={() => handleBackup("PROJECT", "ERPSI")} 
            disabled={running}
            className="font-bold"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            BACKUP ERPSI
          </Button>
          <Button 
            size="lg" 
            onClick={() => handleBackup("GLOBAL")} 
            disabled={running}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg"
          >
            {running ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5 fill-current" />
            )}
            SAUVEGARDE GLOBALE
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Sauvegarde Automatique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Toutes les 3h</div>
            <p className="text-xs text-muted-foreground mt-1">Fréquence de planification</p>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Prochaine Exécution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-warning">
              {stats.next_run_at ? formatTime(stats.next_run_at) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.next_run_at ? "Tâche planifiée active" : "Tâche planifiée inactive"}</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Dernière Sauvegarde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-success">
              {lastSuccess ? formatDateTime(lastSuccess.created_at) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{lastSuccess ? `Réussie · ${lastSuccess.trigger_type === 'AUTOMATIC' ? 'automatique' : 'manuelle'}` : 'Aucune réussie'}</p>
          </CardContent>
        </Card>

        <Card className="border-info/20 bg-info/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-info" />
              Sauvegardes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.count}</div>
            <p className="text-xs text-muted-foreground mt-1">Historique total</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-xs font-medium px-1">Projet</label>
          <select 
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
            value={filters.project}
            onChange={(e) => setFilters(f => ({ ...f, project: e.target.value }))}
          >
            <option value="all">Tous les projets</option>
            <option value="ERPSI">ERPSI</option>
            <option value="AVODA">AVODA</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-xs font-medium px-1">Type</label>
          <select 
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
            value={filters.type}
            onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
          >
            <option value="all">Tous</option>
            <option value="PROJECT">Projet</option>
            <option value="GLOBAL">Globale</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-xs font-medium px-1">Statut</label>
          <select 
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Tous</option>
            <option value="Réussie">Réussie</option>
            <option value="Échec">Échec</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des sauvegardes
          </CardTitle>
          <CardDescription>
            Liste des dernières sauvegardes globales effectuées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs uppercase">
                  <TableHead>Date / Heure</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Contenu</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Aucun historique disponible.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((row) => (
                    <TableRow key={row.backup_id} className="group">
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {row.project_name || "Tous les projets"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs" title={row.fichier_nom || ""}>
                        {row.fichier_nom || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatSize(row.taille_octets)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.scope_type === 'GLOBAL' ? 'Sauvegarde complète' : 'Données projet'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs uppercase font-bold">
                          {row.is_test ? 'Test' : row.trigger_type === 'AUTOMATIC' ? 'Auto' : 'Manuel'}
                        </Badge>
                        {row.duree_ms != null && <div className="text-xs text-muted-foreground mt-1">{Math.round(row.duree_ms / 1000)} s</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {row.statut === "succes" ? (
                            <div className="flex items-center gap-1 text-success" title="Réussie">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs font-bold uppercase">OK</span>
                            </div>
                          ) : row.statut === "echec" ? (
                            <div className="flex items-center gap-1 text-destructive" title={row.error_message || "Erreur"}>
                              <XCircle className="h-4 w-4" />
                              <span className="text-xs font-bold uppercase">Échec</span>
                              {row.error_message && <span className="text-xs max-w-[160px] truncate">{row.error_message}</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-primary">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs font-bold uppercase">...</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {row.destination_url && (
                            <Button aria-label="Ouvrir"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => window.open(row.destination_url!, "_blank")}
                              title="Voir sur Google Drive"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button aria-label="Chargement" 
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-warning"
                            onClick={() => handleRestore(row)}
                            disabled={row.statut !== "succes" || !!restoring}
                            title="Restaurer"
                          >
                            {restoring === row.backup_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle className="text-warning flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Zone de Danger : Restauration Manuelle
          </CardTitle>
          <CardDescription className="text-warning">
            Utilisez cette section uniquement si vous avez un fichier de sauvegarde (.zip) externe à importer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-warning/40 rounded-lg p-6 bg-white cursor-pointer hover:bg-warning/10 transition-colors">
              <Download className="h-8 w-8 text-warning mb-2" />
              <span className="text-sm font-medium">Glissez ou cliquez pour importer une archive globale (.zip)</span>
              <input 
                type="file" 
                accept=".zip" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!await askConfirm("Attention : l'import d'un fichier externe va modifier les données de l'ERP. Continuer ?")) return;
                  
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = (reader.result as string).split(',')[1];
                    setRestoring("external");
                    try {
                      const res = await startRestore({ data: { base64, fileName: file.name } });
                      toast.success(`Import réussi : ${res.tables.length} tables restaurées.`);
                      loadData();
                    } catch (err) {
                      toast.error(friendlyError(err));
                    } finally {
                      setRestoring(null);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
