import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const searchSchema = z.object({
  perm: fallback(z.string(), "").optional(),
  from: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/_authenticated/acces-refuse")({
  validateSearch: zodValidator(searchSchema),
  component: AccesRefusePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function AccesRefusePage() {
  const { perm, from } = useSearch({ from: "/_authenticated/acces-refuse" });
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <h1 className="ds-page-title">Accès refusé (403)</h1>
      <p className="text-muted-foreground">
        Vous n'avez pas les droits nécessaires pour accéder à cette page.
      </p>
      {perm ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          Permission requise :{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">
            {perm}
          </code>
        </div>
      ) : null}
      {from ? (
        <p className="text-xs text-muted-foreground">
          Depuis : <code className="font-mono">{from}</code>
        </p>
      ) : null}
      <p className="max-w-md text-sm text-muted-foreground">
        Contactez un administrateur pour demander l'attribution de cette permission via{" "}
        <em>Rôles &amp; Permissions</em>.
      </p>
      <div className="flex gap-2 pt-2">
        <Button asChild variant="outline">
          <Link to="/dashboard">Retour au tableau de bord</Link>
        </Button>
        <Button asChild>
          <Link to="/profil">Mon profil</Link>
        </Button>
      </div>
    </div>
  );
}
