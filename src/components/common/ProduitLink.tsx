import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function ProduitLink({ produitId, nom, className }: {
  produitId: string | null | undefined;
  nom: string | null | undefined;
  className?: string;
}) {
  const label = nom || "—";
  if (!produitId) return <span className={className}>{label}</span>;
  return <Link to="/produits/$produitId" params={{ produitId }}
    onClick={(e) => e.stopPropagation()}
    className={cn("font-medium text-primary hover:underline", className)}
    title={`Ouvrir la fiche de ${label}`}>{label}</Link>;
}