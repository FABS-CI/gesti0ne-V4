import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Lien vers la fiche client, toujours basé sur le vrai client_id (jamais sur le nom).
 * Stoppe la propagation pour ne pas déclencher le clic de la ligne parente.
 * Sans client_id : affiche le nom en texte simple.
 */
export function ClientLink({
  clientId,
  nom,
  className,
}: {
  clientId: string | null | undefined;
  nom: string | null | undefined;
  className?: string;
}) {
  const label = nom || "—";
  if (!clientId) return <span className={className}>{label}</span>;
  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId }}
      onClick={(e) => e.stopPropagation()}
      className={cn("font-medium text-primary hover:underline", className)}
      title={`Ouvrir la fiche de ${label}`}
    >
      {label}
    </Link>
  );
}
