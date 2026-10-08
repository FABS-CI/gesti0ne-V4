import { getCurrentUser } from "@/lib/current-user";
import { friendlyError } from '@/lib/friendly-error';
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, Loader2, ShieldAlert, ShieldCheck, XCircle, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { checkGoogleDrive, testGoogleDriveUpload } from "@/lib/gdrive-admin.functions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/google-drive")({
  component: GoogleDriveAdminPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type CheckOk = {
  ok: true;
  status: number;
  user: { displayName?: string; emailAddress?: string; photoLink?: string } | null;
  quota: { limit?: string; usage?: string; usageInDrive?: string } | null;
};
type CheckKo = { ok: false; status: number; error: string };

function fmtBytes(n?: string) {
  if (!n) return "—";
  const v = Number(n);
  if (!isFinite(v)) return n;
  if (v < 1024) return `${v} o`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} Ko`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} Mo`;
  return `${(v / 1024 ** 3).toFixed(2)} Go`;
}

function GoogleDriveAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CheckOk | CheckKo | null>(null);
  const check = useServerFn(checkGoogleDrive);
  const testUp = useServerFn(testGoogleDriveUpload);

  useEffect(() => {
    (async () => {
      const { data: u } = await getCurrentUser();
      if (!u.user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role_compat", {
        _user_id: u.user.id,
        _role: "super_admin",
      });
      setIsAdmin(!error && data === true);
    })();
  }, []);

  async function runCheck() {
    setChecking(true);
    try {
      const r = (await check()) as CheckOk | CheckKo;
      setResult(r);
      if (r.ok) toast.success("Connexion Google Drive validée");
      else toast.error(`Échec (${r.status})`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setChecking(false);
    }
  }

  async function runUpload() {
    setUploading(true);
    try {
      const r = await testUp();
      if (r.ok) toast.success(`Test upload OK — fichier ${r.name} créé puis supprimé`);
      else toast.error(`Upload échoué (${r.status})`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setUploading(false);
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Vérification des accès…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" /> Accès réservé aux super-administrateurs
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" /> Connecteur Google Drive
        </h1>
        <p className="text-sm text-muted-foreground">
          Administration → Connecteurs → Google Drive. Les identifiants sont gérés par Lovable Cloud
          (OAuth). Utilisez cette page pour valider la connexion et les permissions avant d'activer
          l'envoi automatique des sauvegardes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            1. Vérifier la connexion &amp; les permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Tester la connexion
            </Button>
            <Button variant="outline" onClick={runUpload} disabled={uploading || !result?.ok}>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Test d'écriture (fichier temporaire)
            </Button>
          </div>

          {result &&
            (result.ok ? (
              <div className="space-y-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-success">
                  <ShieldCheck className="h-4 w-4" /> Connexion validée (HTTP {result.status})
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Compte Google lié</div>
                    <div className="font-medium">{result.user?.displayName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {result.user?.emailAddress ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Quota Drive</div>
                    <div className="text-sm">
                      <b>{fmtBytes(result.quota?.usage)}</b> utilisés
                      {result.quota?.limit && <> sur {fmtBytes(result.quota.limit)}</>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dans Mon Drive : {fmtBytes(result.quota?.usageInDrive)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="text-muted-foreground">Portées OAuth actives&nbsp;:</span>
                  <Badge variant="secondary">drive.file</Badge>
                  <Badge variant="secondary">drive.appdata</Badge>
                  <Badge variant="secondary">drive.readonly</Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <XCircle className="h-4 w-4" /> Échec (HTTP {result.status})
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {result.error}
                </pre>
                <div className="text-xs text-muted-foreground">
                  Reconnectez le connecteur Google Drive depuis Cloud → Connecteurs.
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Activation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Une fois la connexion validée (étapes 1 vertes), retournez sur
            <b> Administration → Sauvegarde &amp; Restauration</b> et cochez
            <b> « Envoyer aussi vers Google Drive »</b> avant de lancer une sauvegarde.
          </p>
          <p>
            Les identifiants OAuth eux-mêmes sont gérés côté Lovable Cloud : il n'y a pas de
            client_id / client_secret à saisir ici.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
