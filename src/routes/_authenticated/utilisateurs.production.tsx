import { formatDateTime } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Download, KeyRound, ShieldAlert, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { listUsersForProduction, generatePasswordResetLink } from "@/lib/users.functions";
import { ROLES } from "@/lib/company";
import { exportPdf } from "@/lib/export-csv";
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
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/utilisateurs/production")({
  component: UtilisateursProductionPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Row = Awaited<ReturnType<typeof listUsersForProduction>>[number];

function fmtDate(v: string | null | undefined) {
  return v ? formatDateTime(v) : "—";
}

function UtilisateursProductionPage() {
  const fetchUsers = useServerFn(listUsersForProduction);
  const genReset = useServerFn(generatePasswordResetLink);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users-production"],
    queryFn: () => fetchUsers(),
    retry: false,
  });
  const [links, setLinks] = useState<Record<string, string>>({});

  const users = (data ?? []) as Row[];

  const stats = useMemo(() => {
    const perRole: Record<string, number> = {};
    let actifs = 0;
    for (const u of users) {
      if (u.actif) actifs += 1;
      for (const r of u.roles) perRole[r] = (perRole[r] ?? 0) + 1;
    }
    return { total: users.length, actifs, inactifs: users.length - actifs, perRole };
  }, [users]);

  async function onGenLink(u: Row) {
    if (!u.email) return;
    try {
      const res = await genReset({ data: { email: u.email } });
      if (res.action_link) {
        setLinks((p) => ({ ...p, [u.id]: res.action_link! }));
        await navigator.clipboard.writeText(res.action_link).catch(() => {});
        toast.success("Lien de réinitialisation généré et copié");
      }
    } catch (e) {
      toast.error(friendlyError(e, "Erreur"));
    }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = users.map((u) => ({
      Nom: u.nom_complet ?? "",
      Login: u.email ?? "",
      Email: u.email ?? "",
      Rôles: u.roles.map((r) => ROLES[r] ?? r).join(", "),
      Statut: u.actif ? "Actif" : "Inactif",
      "Compte confirmé": u.confirmed ? "Oui" : "Non",
      "Créé le": fmtDate(u.created_at),
      "Dernière connexion": fmtDate(u.last_sign_in_at),
      "Lien de réinitialisation": links[u.id] ?? "",
      "Première connexion": u.last_sign_in_at ? "Non" : "Oui (temporaire)",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Utilisateurs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utilisateurs-production-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    await exportPdf(
      "utilisateurs-production",
      ["Nom", "Login / Email", "Rôles", "Statut", "Créé le", "Dernière connexion", "1ère conn."],
      users.map((u) => [
        u.nom_complet ?? "—",
        u.email ?? "—",
        u.roles.map((r) => ROLES[r] ?? r).join(", ") || "—",
        u.actif ? "Actif" : "Inactif",
        fmtDate(u.created_at),
        fmtDate(u.last_sign_in_at),
        u.last_sign_in_at ? "Non" : "Oui",
      ]),
      {
        pageTitle: "LISTE DES UTILISATEURS — MISE EN PRODUCTION",
        summary: [
          { label: "Total utilisateurs", value: String(stats.total) },
          { label: "Comptes actifs", value: String(stats.actifs) },
          { label: "Comptes inactifs", value: String(stats.inactifs) },
          { label: "Rôles distincts", value: String(Object.keys(stats.perRole).length) },
          { label: "Généré le", value: formatDateTime(new Date()) },
        ],
      },
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="ds-page-title">Accès restreint</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {friendlyError(error, "Réservé au super administrateur.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-[#F97316]" />
          <div>
            <h1 className="ds-page-title">Utilisateurs — Mise en production</h1>
            <p className="text-sm text-muted-foreground">
              Distribution des accès · {stats.total} comptes · {stats.actifs} actifs ·{" "}
              {stats.inactifs} inactifs
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Object.entries(stats.perRole).map(([r, n]) => (
          <div key={r} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">{ROLES[r] ?? r}</div>
            <div className="text-2xl font-bold">{n}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-warning/10 p-3 text-xs text-warning">
        <strong>Sécurité :</strong> les mots de passe sont stockés chiffrés et ne peuvent jamais
        être affichés. Utilisez le bouton « Lien reset » pour générer un lien temporaire de
        réinitialisation à remettre à l'utilisateur — il devra définir son mot de passe à la
        première connexion.
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Login / Email</TableHead>
              <TableHead>Rôles</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>Mot de passe</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Aucun utilisateur
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nom_complet || "—"}</TableCell>
                  <TableCell>{u.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r} variant="secondary">
                            {ROLES[r] ?? r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.actif ? "default" : "secondary"}>
                      {u.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(u.last_sign_in_at)}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">
                    {links[u.id] ? (
                      <a
                        href={links[u.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Lien reset (copié)
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Chiffré — non affichable</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onGenLink(u)}>
                      <KeyRound className="mr-1 h-3.5 w-3.5" /> Générer lien
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}