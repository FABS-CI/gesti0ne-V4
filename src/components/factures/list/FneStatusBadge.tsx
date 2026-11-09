import { Link as RLink } from "@tanstack/react-router";
import { StatusPill, type StatusTone } from "@/components/common/StatusPill";

type FneInfo = { statut: string; fne_id: string; code_dgi: string | null };

const FNE: Record<string, { tone: StatusTone; label: string }> = {
  accepted: { tone: "success", label: "Certifiée" },
  pending: { tone: "warning", label: "En attente" },
  submitted: { tone: "info", label: "En cours" },
};

export function FneStatusBadge({ info }: { info: FneInfo | undefined }) {
  if (!info) {
    return <StatusPill tone="neutral">Non envoyée</StatusPill>;
  }
  const meta = FNE[info.statut] ?? { tone: "danger" as const, label: "Rejetée" };
  return (
    <RLink to="/fne-detail/$factureId" params={{ factureId: info.fne_id }} className="inline-flex">
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
    </RLink>
  );
}
