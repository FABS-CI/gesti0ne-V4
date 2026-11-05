import { Link as RLink } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";

type FneInfo = { statut: string; fne_id: string; code_dgi: string | null };

export function FneStatusBadge({ info }: { info: FneInfo | undefined }) {
  if (!info) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        Non envoyée
      </Badge>
    );
  }
  return (
    <RLink to="/fne-detail/$factureId" params={{ factureId: info.fne_id }} className="inline-flex">
      {info.statut === "accepted" ? (
        <Badge style={{ backgroundColor: "#10B981", color: "#fff" }} className="gap-1">
          Certifiée
        </Badge>
      ) : info.statut === "pending" ? (
        <Badge style={{ backgroundColor: "#F59E0B", color: "#fff" }} className="gap-1">
          En attente
        </Badge>
      ) : info.statut === "submitted" ? (
        <Badge style={{ backgroundColor: "#3B82F6", color: "#fff" }} className="gap-1">
          En cours
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          Rejetée
        </Badge>
      )}
    </RLink>
  );
}
