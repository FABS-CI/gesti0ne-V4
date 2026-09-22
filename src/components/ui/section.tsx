import { Suspense, type ComponentType, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Section — enveloppe standard pour un bloc de page qui charge ses
 * propres données (via `useSuspenseQuery` / `React.lazy`). Combine :
 *   - un Suspense boundary local (skeleton ciblé),
 *   - un ErrorBoundary local (le reste de la page reste utilisable),
 *   - un bouton "Réessayer" qui reset le boundary et relance la query.
 *
 * Cela remplace le pattern "spinner global sur toute la page" qui bloque
 * l'affichage de la sidebar et des blocs déjà en cache.
 */

function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = friendlyError(error, "");
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Impossible d'afficher cette section
        </span>
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={resetErrorBoundary}
        className="gap-1.5"
      >
        <RotateCw className="h-3.5 w-3.5" />
        Réessayer
      </Button>
    </div>
  );
}

export interface SectionProps {
  /** Skeleton affiché pendant Suspense. Fournir un skeleton ciblé. */
  fallback: ReactNode;
  /** Composant d'erreur custom (optionnel). */
  errorFallback?: ComponentType<FallbackProps>;
  /** Callback appelé au reset du boundary (ex. queryClient.invalidateQueries). */
  onReset?: () => void;
  children: ReactNode;
}

export function Section({
  fallback,
  errorFallback,
  onReset,
  children,
}: SectionProps) {
  return (
    <ErrorBoundary
      FallbackComponent={errorFallback ?? DefaultErrorFallback}
      onReset={onReset}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
