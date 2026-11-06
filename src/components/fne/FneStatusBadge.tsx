import { Badge } from "@/components/ui/badge";
import { STATUT_FNE_COLOR, STATUT_FNE_LABEL, type FNEStatus } from "@/lib/fne-api";

export function FneStatusBadge({ statut }: { statut: string }) {
  const s = (statut as FNEStatus) ?? "pending";
  return (
    <Badge style={{ backgroundColor: STATUT_FNE_COLOR[s] ?? "#999", color: "#fff" }}>
      {STATUT_FNE_LABEL[s] ?? s}
    </Badge>
  );
}
