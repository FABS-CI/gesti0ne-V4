import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  getClientSessionId,
  newClientErrorId,
  readServerRequestId,
} from "../lib/client-error-tracing";

export function RouteNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="ds-page-title text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page demandée n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [ids] = useState(() => ({
    clientErrorId: newClientErrorId(),
    clientSessionId: getClientSessionId(),
    serverRequestId: readServerRequestId(),
  }));
  const traceId = ids.serverRequestId ?? ids.clientErrorId;
  // eslint-disable-next-line no-console
  console.error(
    `[client:${ids.clientSessionId}:${ids.clientErrorId}] ` +
      (ids.serverRequestId ? `server=${ids.serverRequestId} ` : "") +
      `route error ->`,
    error,
  );
  useEffect(() => {
    reportLovableError(error, {
      boundary: "tanstack_route_error_component",
      clientSessionId: ids.clientSessionId,
      clientErrorId: ids.clientErrorId,
      serverRequestId: ids.serverRequestId,
    });
  }, [error, ids]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="ds-page-title text-foreground">
          Cette page n'a pas pu charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'a pas pu s'afficher. Rechargez-la ; si le problème revient, signalez-le à un administrateur.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Trace ID:{" "}
          <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {traceId}
          </code>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
